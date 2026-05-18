import { Controller, Get } from '@nestjs/common'
import { PackageMetadata, PackageRegistry } from '@svx/common'

@Controller('packages')
export class PackagesController {
  @Get()
  all(): PackageMetadata[] {
    return PackageRegistry.all()
  }
}
