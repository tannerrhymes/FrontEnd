import * as ExcelJS from 'exceljs';
import Papa from 'papaparse';

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_TYPES = ['csv', 'xlsx', 'xls'];

export const validateFileOnServer = async (file) => {
    const errors = [];
    
    // Size validation
    if (file.size > MAX_FILE_SIZE) {
        errors.push(`File ${file.name} exceeds maximum size of 5MB`);
        return errors;
    }

    // Type validation
    const fileType = file.name.split('.').pop().toLowerCase();
    if (!ALLOWED_TYPES.includes(fileType)) {
        errors.push(`File type ${fileType} is not supported`);
        return errors;
    }

    try {
        // Content validation
        if (fileType === 'csv') {
            const text = await file.text();
            return new Promise((resolve) => {
                Papa.parse(text, {
                    complete: (results) => {
                        const contentErrors = validateDataStructure(results.data);
                        resolve([...errors, ...contentErrors]);
                    },
                    error: (error) => {
                        errors.push(`CSV parsing error: ${error.message}`);
                        resolve(errors);
                    }
                });
            });
        } else {
            const buffer = await file.arrayBuffer();
            const workbook = new ExcelJS.Workbook();
            await workbook.xlsx.load(buffer);
            
            let allData = [];
            workbook.worksheets.forEach(worksheet => {
                const sheetData = [];
                worksheet.eachRow({ includeEmpty: false }, row => {
                    sheetData.push(row.values);
                });
                allData = [...allData, ...sheetData];
            });
            
            const contentErrors = validateDataStructure(allData);
            return [...errors, ...contentErrors];
        }
    } catch (error) {
        errors.push(`File processing error: ${error.message}`);
        return errors;
    }
};

const validateDataStructure = (data) => {
    const errors = [];

    // Check if data is empty
    if (!data || data.length === 0) {
        errors.push('File contains no data');
        return errors;
    }

    // Validate headers (first row)
    const requiredColumns = ['date', 'value']; // adjust based on your needs
    const headers = data[0];
    
    requiredColumns.forEach(column => {
        if (!headers.includes(column)) {
            errors.push(`Missing required column: ${column}`);
        }
    });

    // Validate data rows
    data.slice(1).forEach((row, index) => {
        // Check for empty rows
        if (!row || row.length === 0) {
            errors.push(`Empty row at line ${index + 2}`);
            return;
        }

        // Validate date format
        const dateValue = row[headers.indexOf('date')];
        if (!isValidDate(dateValue)) {
            errors.push(`Invalid date format at line ${index + 2}`);
        }

        // Validate numeric values
        const value = row[headers.indexOf('value')];
        if (!isValidNumber(value)) {
            errors.push(`Invalid numeric value at line ${index + 2}`);
        }
    });

    return errors;
};

const isValidDate = (dateString) => {
    const date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
};

const isValidNumber = (value) => {
    return !isNaN(parseFloat(value)) && isFinite(value);
}; 