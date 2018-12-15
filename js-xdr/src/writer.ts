import { writeFileSync, copyFileSync, mkdirSync } from "fs";
import { join } from "path";

import { TypeDefinition } from "../types/types";

export function initializeOutputPath(outputPath: string) {
  mkdirSync(outputPath, { recursive: true });
}

export function generateXdrDefinition(types: Record<string, TypeDefinition>, outputPath: string) {
  let result = `import * as converter from './converter'`;

  let toBeDone: string[];
  if (process.env.GENERATE_TYPES) {
    toBeDone = process.env.GENERATE_TYPES.split(',').map(name => name.trim());
  } else {
    toBeDone = Object.keys(types); // generate all types
  }

  const done: string[] = [];

  let typeName: string | undefined;
  while ((typeName = toBeDone.pop())) {
    const typeDefinition = types[typeName];

    result += `
      export type ${typeName} = ${typeDefinition.tsType};
      export const ${typeName}: converter.XdrConverter<${typeName}> = converter.generator(() => ${
      typeDefinition.converter
    });
    `;

    done.push(typeName);
    Object.keys(typeDefinition.dependencies).forEach(key => {
      if (done.indexOf(key) === -1 && toBeDone.indexOf(key) === -1) {
        toBeDone.push(key);
      }
    });
  }

  const mainFileName = process.env.MAIN_FILE_NAME || "xdr.ts";
  writeFileSync(join(outputPath, mainFileName), result);
}

const staticFiles = [
  "basicTypes.ts",
  "compoundTypes.ts",
  "converter.ts",
  "int64.ts",
  "streams.ts",
  "types.ts",
];

export function copyStaticFiles(outputPath: string) {
  staticFiles.forEach(fileName => {
    copyFileSync(join(__dirname, "../../static/", fileName), join(outputPath, fileName));
  });
}
