export enum Provider {
  SMILES = 'smiles',
  AZUL = 'azul',
  QATAR = 'qatar',
  IBERIA = 'iberia',
  TAP = 'tap',
}

export const PROVIDER_VALUES = Object.values(Provider) as string[];

export const PROVIDER_LABEL: Record<Provider, string> = {
  [Provider.SMILES]: 'Smiles',
  [Provider.AZUL]: 'Azul',
  [Provider.QATAR]: 'Qatar Airways',
  [Provider.IBERIA]: 'Iberia',
  [Provider.TAP]: 'TAP Portugal',
};
