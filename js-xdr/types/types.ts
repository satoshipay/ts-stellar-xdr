export interface TypeDefinition {
  tsType: string;
  converter: string;
  dependencies: Record<string, true>;
  optionalType?: string;
}

type XdrValue = number | string;

export type EnumDefinition = Record<string, XdrValue>;
export type StructDefinition = Array<[string, TypeDefinition]>;

type UnionSwitchDefinition<NormalArms> = [XdrValue, NormalArms | TypeDefinition]; //TypeDefinition only for void, otherwise type names
export type UnionDefinition<NormalArms extends string, DefaultArm extends string> = {
  switchOn: TypeDefinition;
  switchName: string;
  switches: UnionSwitchDefinition<NormalArms>[];
  arms: Record<NormalArms | DefaultArm, TypeDefinition>;
  defaultArm?: DefaultArm | TypeDefinition; //TypeDefinition only for void, otherwise type names
};

export type DefinitionFactory = (
  definition: {
    typedef: (name: string, type: TypeDefinition) => void;
    enum: (name: string, enumDefinition: EnumDefinition) => void;
    struct: (name: string, structDefinition: StructDefinition) => void;
    union: <NormalArms extends string, DefaultArm extends string>(
      name: string,
      unionDefinition: UnionDefinition<NormalArms, DefaultArm>
    ) => void;
    const: (name: string, value: number) => void;
    lookup: (name: string) => number | TypeDefinition;
    option: (childType: TypeDefinition) => TypeDefinition;
    opaque: (length: number) => TypeDefinition;
    varOpaque: (maxLength?: number) => TypeDefinition;
    bool: () => TypeDefinition;
    void: () => TypeDefinition;
    string: (maxLength?: number) => TypeDefinition;
    array: (childType: TypeDefinition, length: number) => TypeDefinition;
    varArray: (childType: TypeDefinition, maxLength?: number) => TypeDefinition;
    int: () => TypeDefinition;
    uint: () => TypeDefinition;
    hyper: () => TypeDefinition;
    uhyper: () => TypeDefinition;
  }
) => void;
