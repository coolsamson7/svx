import { PackageRegistry } from './package-registry'
import { PackageMetadata, PackageType } from './package-metadata'
import { AbstractPackage } from './abstract-package'

function declarePackage(type: PackageType, meta: Omit<PackageMetadata, 'loaded' | 'type'>) {
  return (target: typeof AbstractPackage) => {
    const full: PackageMetadata = { ...meta, type, loaded: true }
    PackageRegistry.register(full)
    target.$metadata = full
  }
}

export function DeclareLibrary(meta: Omit<PackageMetadata, 'loaded' | 'type'>) {
  return declarePackage('library', meta)
}

export function DeclareApplication(meta: Omit<PackageMetadata, 'loaded' | 'type'>) {
  return declarePackage('application', meta)
}
