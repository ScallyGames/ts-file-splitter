const fs = require('fs');
const program = require('commander');
const kebabcase = require('lodash.kebabcase');
const os = require('os');


let fileValue;

let importBlock;

const functionNames = [];

program
    .version('0.1.0')
    .arguments('<file>')
    .action(function(file) {
        fileValue = file;
    })
    .parse(process.argv)

// read file passed as parameter
fs.readFile(fileValue, (err, data) => {
    if (err) {
        console.log(err);
    }

    // get filename without file ending
    const fileName = fileValue.substring(0, fileValue.lastIndexOf('.'));

    // create folder with same name as the file (without ending)
    fs.mkdir(fileName, (err) => {
        if (err) {
            console.log(err);
        }

        // file content
        let content = data.toString();

        let startPointer = 0;
        let endPointer = 0;
        let lastEnd = 0;

        // loop until no more functions are found
        while (true) {
            // find start of function statement
            startPointer = content.indexOf('function', startPointer);
            // find start of opening curly
            endPointer = content.indexOf(')', startPointer) // check if round brackets are allowed in parameter list
            if (endPointer === -1) {
                break;
            }
            endPointer = content.indexOf('{', endPointer)

            // if non left quit
            if (startPointer === -1 || endPointer === -1) {
                break;
            }

            // start with first curly
            let countBraces = 1;
            endPointer++;


            // count curlies until closing bracket for the function statement is found
            // FIXME: fails with typescript function return type containing brackets
            while (countBraces > 0) {
                if (content[endPointer] === '{') {
                    countBraces++;
                } else if (content[endPointer] === '}') {
                    countBraces--;
                }
                endPointer++;
            }

            // FIXME: might be problematic with nested functions
            const jsdocRegex = /(\/\*\*[\s\S]*\*\/[\s]*)function/
            const jsdocMatch = jsdocRegex.exec(content.substring(lastEnd, endPointer))
            const jsdocComment = jsdocMatch ? jsdocMatch[1] : ''

            const functionCode = content.substring(startPointer, endPointer);

            // on first found function store everything before that to attach it to every file
            if (!importBlock) {
                const importBlockEnd = !!jsdocComment ? content.indexOf(jsdocComment) : content.indexOf(functionCode);
                importBlock = content.substring(0, importBlockEnd)
                    // get relative imports one level higher
                    .replace(/'\.{2}\//g, `'../../`)
                    .replace(/'\.\//g, `'../`);


            }

            const functionNameRegex = /function\s+([^(\s]*)\s*\(/;
            const functionName = functionNameRegex.exec(functionCode)[1];

            // add to list of outsourced functions
            functionNames.push(functionName);

            // write file on fileName/function-name.ts with imports, comment and exported function
            fs.writeFile(fileName + '/' + kebabcase(functionName) + '.ts', importBlock + jsdocComment + 'export ' + functionCode);

            // continue from after ending curly
            startPointer = lastEnd = endPointer;
        }

        // generate import block from outsourced functions
        const indexImportBlock = functionNames.map(functionName => `import { ${functionName} } from './${kebabcase(functionName)}';`).join(os.EOL);

        // create index.ts
        fs.writeFile(fileName + '/index.ts', indexImportBlock + os.EOL + content.substring(lastEnd) + os.EOL)
    })
})