const fs = require('fs');
const program = require('commander');
const kebabcase = require('lodash.kebabcase');
const os = require('os');
const ts = require('byots');


let fileValue;

const dependencyImports = [];
const definedFunctions = {};
const barrelExportDeclarations = [];
const barrelExportAssignments = [];

program
    .version('0.1.0')
    .arguments('<file>')
    .action(function(file) {
        fileValue = file;
    })
    .parse(process.argv)




// read file passed as parameter
const data = fs.readFileSync(fileValue)

// get filename without file ending
const fileName = fileValue.substring(0, fileValue.lastIndexOf('.'));

// create folder with same name as the file (without ending)
if (!fs.existsSync(fileName)) {
    fs.mkdirSync(fileName);
}


let content = data.toString();

const sourceFile = ts.createSourceFile(fileValue, content,
    ts.ScriptTarget.ES5,
    true,
    ts.LanguageVariant.Standard
);



parseAllChildren(sourceFile);

// generate import block from outsourced functions
const indexImportBlock = Object.keys(definedFunctions).map(functionName => `import { ${functionName} } from './${kebabcase(functionName)}';`).join(os.EOL);

// create index.ts
fs.writeFile(
    fileName + '/index.ts',
    indexImportBlock + os.EOL +
    barrelExportDeclarations.join('') +
    barrelExportAssignments.join('') +
    os.EOL
);


// write file on fileName/function-name.ts with imports, comment and exported function
Object.keys(definedFunctions).forEach(functionName => {
    const outsourcedContent =
        // TODO: only import those that are needed
        dependencyImports.join('')
        // get relative imports one level higher
        .replace(/'\.{2}\//g, `'../../`)
        .replace(/'\.\//g, `'../`) +
        os.EOL +
        // TODO: only import those that are needed
        // cross-import own files to have all functions available
        Object.keys(definedFunctions).filter(func => func !== functionName).map(func => `import { ${func} } from './${kebabcase(func)}';`).join(os.EOL) +
        os.EOL +
        definedFunctions[functionName] + os.EOL + os.EOL +
        `export { ${functionName} };` + os.EOL +
        `export default { ${functionName} };` + os.EOL;

    fs.writeFile(
        fileName + '/' + kebabcase(functionName) + '.ts',
        outsourcedContent,
        err => {
            if (err) {
                console.error(err);
            }
        }
    );
})


function parseAllChildren(node, depth = 0) {
    if (depth === 2) {
        const nodeContent = content.substring(node.pos, node.end);

        switch (node.kind) {
            case ts.SyntaxKind.FunctionDeclaration:
                const functionName = node.name.text;

                console.log(ts.formatSyntaxKind(node.kind), functionName, node.pos, node.end);

                definedFunctions[functionName] = nodeContent;

                break;
            case ts.SyntaxKind.ImportDeclaration:
                dependencyImports.push(nodeContent);
                break;
            case ts.SyntaxKind.ExportAssignment:
                barrelExportAssignments.push(nodeContent);
                break;
            case ts.SyntaxKind.ExportDeclaration:
                barrelExportDeclarations.push(nodeContent);
                break;
            default:
                console.warn('Unexpected element: ', ts.formatSyntaxKind(node.kind), ts.content.substring(node.pos, node.end), '. Please check the according code and copy it yourself.');
                break;
        }
    } else if (depth > 2) {
        // end early if past function layer
        return;
    }
    // recursively handle next layer
    depth++;
    node.getChildren().forEach(c => parseAllChildren(c, depth));
}