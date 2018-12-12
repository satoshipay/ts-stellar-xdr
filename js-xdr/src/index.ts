import { writeFileSync, copyFileSync } from 'fs';
import { join } from 'path';

type DefinitionFactory = any;

interface TypeDefinition {
  tsType: string,
  converter: string,
  dependencies: Record<string, true>,
  optionalType?: string,
}

type XdrValue = number | string;
type EnumDefinition = Record<string, XdrValue>;
type StructDefinition = Array<[string, TypeDefinition]>;


type UnionSwitchDefinition<NormalArms> = [XdrValue, NormalArms | TypeDefinition]; //TypeDefinition only for void, otherwise type names
type UnionDefinition<NormalArms extends string, DefaultArm extends string> = {
  switchOn: TypeDefinition,
  switchName: string,
  switches: UnionSwitchDefinition<NormalArms>[],
  arms: Record<NormalArms | DefaultArm, TypeDefinition>,
  defaultArm?: DefaultArm | TypeDefinition //TypeDefinition only for void, otherwise type names
}

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

      const tsType = typeEntries.join(' | ');
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
      }
    },

    struct: (name: string, structDefinition: StructDefinition) => {
      const subTypes = structDefinition.map(entry => {
        const [key, type] = entry;
        return type.optionalType ? `${JSON.stringify(key)}?: ${type.optionalType}` : `${JSON.stringify(key)}: ${type.tsType}`;
      });
      const subConverters = structDefinition.map(entry => {
        const [key, type] = entry;
        return `${JSON.stringify(key)}: ${type.converter}`;
      }, {});
      const dependencies = structDefinition.reduce<Record<string, true>>((obj, entry) => {
        return {...obj, ...entry[1].dependencies};
      }, {})

      const tsType = `{${subTypes.join(';')}}`
      const converters = `{${subConverters.join(',')}}`
      types[name] = {
        tsType,
        converter: `converter.Struct<${name}>('${name}', ${converters})`,
        dependencies
      }
    },

    union: <NormalArms extends string, DefaultArm extends string>(name: string, unionDefinition: UnionDefinition<NormalArms, DefaultArm>) => {
      const subtypes = unionDefinition.switches.map(caseSpec => {
        if (typeof caseSpec[1] === "string") {
          const arm = unionDefinition.arms[caseSpec[1]];
          if (arm === undefined) {
            throw new Error(`Union definition "${name}" has a switch "${caseSpec[1]}" without an arm definition`);
          }
          const value = arm.optionalType ? `value?: ${arm.optionalType}` : `value: ${arm.tsType}`;
          return `{type: ${JSON.stringify(caseSpec[0])}, ${value}}`
        } else {
          return `{type: ${JSON.stringify(caseSpec[0])}}`
        }
      });

      const subconverters = unionDefinition.switches.map(caseSpec => {
        if (typeof caseSpec[1] === "string") {
          const arm = unionDefinition.arms[caseSpec[1]];
          if (arm === undefined) {
            throw new Error(`Union definition "${name}" has a switch "${caseSpec[1]}" without an arm definition`);
          }
          return `{type: ${JSON.stringify(caseSpec[0])}, converter: ${arm.converter}}`
        } else {
          return `{type: ${JSON.stringify(caseSpec[0])}}`
        }
      });

      let dependencies = Object.values(unionDefinition.arms).reduce<Record<string, true>>((obj, arm) => {
        return {...obj, ...(arm as TypeDefinition).dependencies};
      }, {});
      dependencies = {...dependencies, ...unionDefinition.switchOn.dependencies};

      if (unionDefinition.defaultArm) {
        if (typeof unionDefinition.defaultArm === "string") {
          const arm = unionDefinition.arms[unionDefinition.defaultArm];
          if (arm === undefined) {
            throw new Error(`Union definition "${name}" has a default case without an arm definition`);
          }
          const value = arm.optionalType ? `value?: ${arm.optionalType}` : `value: ${arm.tsType}`;
          subtypes.push(`{default: true, ${value}}`)
          subconverters.push(`{default: true, converter: ${arm.converter}}`);
        } else {
          subtypes.push(`{default: true }`)
          subconverters.push(`{default: true }`)
        }
      }

      const tsType = `${subtypes.join(' | ')}`;
      const converters = `[${subconverters.join(',')}]`;
      types[name] = {
        tsType,
        converter: `converter.Union<${name}, ${unionDefinition.switchOn.tsType}>('${name}', ${unionDefinition.switchOn.converter}, ${converters})`,
        dependencies,
      }
    },

    const: (name: string, value: any) => {
      constants[name] = value;
    },

    lookup: (name: string, _value: any) => {
      return {
        tsType: name,
        converter: name,
        dependencies: { [name]: true }
      }
    },

    option: (childType: TypeDefinition) => {
      return {
        tsType: `${childType.tsType} | undefined`,
        converter: `converter.Option<${childType.tsType}>(${childType.converter})`,
        optionalType: childType.tsType,
        dependencies: childType.dependencies
      }
    },

    opaque: (length: number) => {
      return {
        tsType: `ArrayBuffer`,
        converter: `converter.FixedOpaque(${length})`,
        dependencies: {}
      }
    },

    varOpaque: (maxLength?: number) => {
      return {
        tsType: `ArrayBuffer`,
        converter: `converter.VarOpaque(${maxLength || ''})`,
        dependencies: {}
      }
    },


    bool: () => {
      return {
        tsType: `boolean`,
        converter: `converter.Boolean`,
        dependencies: {}
      }
    },

    void: () => {
      return {
        tsType: `void`,
        converter: `converter.Void`,
        dependencies: {}
      }
    },

    string: (maxLength?: number) => {
      return {
        tsType: `string`,
        converter: `converter.String(${maxLength || ''})`,
        dependencies: {}
      }
    },

    array: (childType: TypeDefinition, length: number) => {
      return {
        tsType: `Array<${childType.tsType}>`,
        converter: `converter.FixedArray<${childType.tsType}>(${childType.converter}, ${length})`,
        dependencies: childType.dependencies
      }
    },

    varArray: (childType: TypeDefinition, maxLength?: number) => {
      return {
        tsType: `Array<${childType.tsType}>`,
        converter: `converter.VarArray<${childType.tsType}>(${childType.converter}, ${maxLength || ''})`,
        dependencies: childType.dependencies
      }
    },

    int: () => {
      return {
        tsType: `number`,
        converter: `converter.Int`,
        dependencies: {}
      }
    },

    uint: () => {
      return {
        tsType: `number`,
        converter: `converter.Uint`,
        dependencies: {}
      }
    },

    hyper: () => {
      return {
        tsType: `converter.Int64`,
        converter: `converter.Hyper`,
        dependencies: {}
      }
    },

    uhyper: () => {
      return {
        tsType: `converter.Uint64`,
        converter: `converter.Uhyper`,
        dependencies: {}
      }
    }
  });

  let result = `import * as converter from './converter'`;

  const toBeDone: string[] = ["TransactionEnvelope", "TransactionResult", "TransactionMeta"]; //Object.keys(types)
  const done: string[] = [];

  let typeName: string | undefined;
  while (typeName = toBeDone.pop()) {
    const typeDefinition = types[typeName];

    result += `
      export type ${typeName} = ${typeDefinition.tsType};
      export const ${typeName}: converter.XdrConverter<${typeName}> = converter.generator(() => ${typeDefinition.converter});
    `

    done.push(typeName);
    Object.keys(typeDefinition.dependencies).forEach(key => {
      if (done.indexOf(key) === -1 && toBeDone.indexOf(key) === -1) {
        toBeDone.push(key);
      }
    })
  }

  writeFileSync(join(__dirname, '../src/test/xdr.ts'), result);
  copyFileSync(join(__dirname, '../xdr/converter.ts'), join(__dirname, '../src/test/converter.ts'));
};