export type PackageType = 'library' | 'application'

export interface PackageMetadata {
  name:    string
  version: string
  type:    PackageType
  loaded:  boolean
}
