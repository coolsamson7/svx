import { PackageMetadata } from './package-metadata'

export class PackageRegistry {
  private static readonly entries = new Map<string, PackageMetadata>()

  // Called by @DeclareLibrary / @DeclareApplication — always loaded: true, upserts any pre-registered entry
  static register(meta: Omit<PackageMetadata, 'loaded'>): void {
    this.entries.set(meta.name, { ...meta, loaded: true })
  }

  // Called before a remote MFE's code has loaded — does not overwrite an already-loaded entry
  static preRegister(meta: Omit<PackageMetadata, 'loaded'>): void {
    if (!this.entries.has(meta.name))
      this.entries.set(meta.name, { ...meta, loaded: false })
  }

  static get(name: string): PackageMetadata | undefined {
    return this.entries.get(name)
  }

  static all(): PackageMetadata[] {
    return [...this.entries.values()]
  }

  static report(): void {
    console.table(this.all())
  }
}
