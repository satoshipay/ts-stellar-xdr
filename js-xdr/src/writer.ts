import { writeFileSync, copyFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";

import { TypeDefinition } from "../types/types";

export function initializeOutputPath(outputPath: string) {
  mkdirSync(outputPath, { recursive: true });
}

export function generateXdrDefinition(types: Record<string, TypeDefinition>, outputPath: string) {
  let result =
    `import * as converter from './converters/index'\n` +
    `import { Integer64, UnsignedInteger64 } from './utils/int64'`;

  let toBeDone: string[];
  if (process.env.GENERATE_TYPES) {
    toBeDone = process.env.GENERATE_TYPES.split(",").map(name => name.trim());
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

  const mainFileName = process.env.MAIN_FILE_NAME;
  if (!mainFileName) {
    throw new Error('Environment variable "MAIN_FILE_NAME" not specified');
  }

  writeFileSync(join(outputPath, mainFileName), result);
}

const staticFiles = [
  "converters/basicTypes.ts",
  "converters/compoundTypes.ts",
  "converters/index.ts",
  "converters/streams.ts",
  "converters/types.ts",
  "utils/int64.ts",
  "index.ts"
];

export function copyStaticFiles(outputPath: string) {
  const usedDirectories: Record<string, boolean> = {};

  staticFiles.forEach(fileName => {
    const directory = dirname(fileName);

    if (!usedDirectories[directory]) {
      usedDirectories[directory] = true;
      mkdirSync(join(outputPath, directory), { recursive: true });
    }

    copyFileSync(join(__dirname, "../../static/", fileName), join(outputPath, fileName));
  });
}
