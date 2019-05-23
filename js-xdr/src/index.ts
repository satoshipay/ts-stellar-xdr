import { TypeDefinition, EnumDefinition, StructDefinition, UnionDefinition, DefinitionFactory } from "../types/types";
import { initializeOutputPath, generateXdrDefinition, copyStaticFiles } from "./writer";

if (process.env.DESTINATION === undefined) {
  throw new Error(`The environment variable "DESTINATION" is not defined`);
}

const outputPath: string = process.env.DESTINATION;
initializeOutputPath(outputPath);

export function config(definitionFactory: DefinitionFactory) {
  const constants: Record<string, number> = {};
  const types: Record<string, TypeDefinition> = {};

  definitionFactory({
    typedef: (name: string, type: TypeDefinition) => {
      types[name] = type;
    },

    enum: (name: string, enumDefinition: EnumDefinition) => {
      const typeEntries: string[] = [];

      Object.keys(enumDefinition).forEach(key => {
        const stringifiedKey = JSON.stringify(key);

        typeEntries.push(stringifiedKey);
      });

      const tsType = typeEntries.join(" | ");
      const enumDefinitionObject = Object.entries(enumDefinition).reduce<Record<string, number>>((obj, nextEntry) => {
        const [key, constant] = nextEntry;
        const resolvedConstant = typeof constant === "number" ? constant : constants[constant];
        if (resolvedConstant === undefined) {
          throw new Error(`Usage of undefined constant ${constant} in enum type ${name}`);
        }

        obj[key] = resolvedConstant;
        return obj;
      }, {});

      types[name] = {
        tsType,
        converter: `converter.Enum<${name}>('${name}', ${JSON.stringify(enumDefinitionObject)})`,
        dependencies: {}
      };
    },

    struct: (name: string, structDefinition: StructDefinition) => {
      const subTypes: string[] = [];
      const subConverters: string[] = [];
      let dependencies: Record<string, true> = {};

      structDefinition.forEach(entry => {
        const [key, type] = entry;
        const stringifiedKey = JSON.stringify(key);
        subTypes.push(
          type.optionalType ? `${stringifiedKey}?: ${type.optionalType}` : `${stringifiedKey}: ${type.tsType}`
        );
        subConverters.push(`[${stringifiedKey}, ${type.converter}]`);
        dependencies = { ...dependencies, ...type.dependencies };
      });

      const tsType = `{${subTypes.join(";")}}`;
      const converters = `[${subConverters.join(",")}]`;
      types[name] = {
        tsType,
        converter: `converter.Struct<${name}>(${converters})`,
        dependencies
      };
    },

    union: <NormalArms extends string, DefaultArm extends string>(
      name: string,
      unionDefinition: UnionDefinition<NormalArms, DefaultArm>
    ) => {
      const subtypes: string[] = [];
      const normalConverters: string[] = [];

      const unionCases: Array<{
        caseType: NormalArms | DefaultArm | TypeDefinition;
        extraField?: string;
      }> = unionDefinition.switches.map(switchSpec => ({
        caseType: switchSpec[1],
        extraField: JSON.stringify(switchSpec[0])
      }));

      let defaultConverter = `, undefined`;
      if (unionDefinition.defaultArm) {
        unionCases.push({ caseType: unionDefinition.defaultArm });
      }

      unionCases.forEach(unionCase => {
        const { caseType, extraField } = unionCase;
        let typeExtra = "";
        let converterExtra;
        if (typeof caseType === "string") {
          const arm = unionDefinition.arms[caseType];
          if (arm === undefined) {
            throw new Error(`Union definition "${name}" has a switch "${extraField}" without an arm definition`);
          }

          const value = arm.optionalType ? `value?: ${arm.optionalType}` : `value: ${arm.tsType}`;
          typeExtra = `, ${value}`;
          converterExtra = `${arm.converter}`;
        }

        if (extraField === undefined) {
          subtypes.push(`{default: number${typeExtra}}`);
          defaultConverter = `, {default: ${converterExtra ? converterExtra : "undefined"}}`;
        } else {
          subtypes.push(`{type: ${extraField}${typeExtra}}`);
          normalConverters.push(`${extraField}: ${converterExtra ? converterExtra : "undefined"}`);
        }
      });

      let dependencies = Object.values(unionDefinition.arms).reduce<Record<string, true>>((obj, arm) => {
        return { ...obj, ...(arm as TypeDefinition).dependencies };
      }, {});
      dependencies = { ...dependencies, ...unionDefinition.switchOn.dependencies };

      const tsType = `${subtypes.join(" | ")}`;
      const converters = `{${normalConverters.join(",")}}`;
      types[name] = {
        tsType,
        converter: `converter.Union('${name}', ${
          unionDefinition.switchOn.converter
        }, ${converters}${defaultConverter})`,
        dependencies
      };
    },

    const: (name: string, value: number) => {
      constants[name] = value;
    },

    lookup: (name: string) => {
      if (constants.hasOwnProperty(name)) {
        return constants[name];
      }

      return {
        tsType: name,
        converter: name,
        dependencies: { [name]: true }
      };
    },

    option: (childType: TypeDefinition) => {
      return {
        tsType: `${childType.tsType} | undefined`,
        converter: `converter.Option<${childType.tsType}>(${childType.converter})`,
        optionalType: childType.tsType,
        dependencies: childType.dependencies
      };
    },

    opaque: (length: number) => {
      return {
        tsType: `ArrayBuffer`,
        converter: `converter.FixedOpaque(${length})`,
        dependencies: {}
      };
    },

    varOpaque: (maxLength?: number) => {
      return {
        tsType: `ArrayBuffer`,
        converter: `converter.VarOpaque(${maxLength || ""})`,
        dependencies: {}
      };
    },

    bool: () => {
      return {
        tsType: `boolean`,
        converter: `converter.Boolean`,
        dependencies: {}
      };
    },

    void: () => {
      return {
        tsType: `undefined`,
        converter: `converter.Void`,
        dependencies: {}
      };
    },

    string: (maxLength?: number) => {
      return {
        tsType: `string`,
        converter: `converter.string(${maxLength || ""})`,
        dependencies: {}
      };
    },

    array: (childType: TypeDefinition, length: number) => {
      return {
        tsType: `Array<${childType.tsType}>`,
        converter: `converter.FixedArray<${childType.tsType}>(${childType.converter}, ${length})`,
        dependencies: childType.dependencies
      };
    },

    varArray: (childType: TypeDefinition, maxLength?: number) => {
      return {
        tsType: `Array<${childType.tsType}>`,
        converter: `converter.VarArray<${childType.tsType}>(${childType.converter}, ${maxLength || ""})`,
        dependencies: childType.dependencies
      };
    },

    int: () => {
      return {
        tsType: `number`,
        converter: `converter.Int`,
        dependencies: {}
      };
    },

    uint: () => {
      return {
        tsType: `number`,
        converter: `converter.Uint`,
        dependencies: {}
      };
    },

    hyper: () => {
      return {
        tsType: `utils.Int64`,
        converter: `converter.Hyper`,
        dependencies: {}
      };
    },

    uhyper: () => {
      return {
        tsType: `utils.Uint64`,
        converter: `converter.Uhyper`,
        dependencies: {}
      };
    }
  });

  generateXdrDefinition(types, outputPath);
  copyStaticFiles(outputPath);
}
