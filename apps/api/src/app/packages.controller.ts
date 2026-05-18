import { Controller, Get } from '@nestjs/common';
import { PackageRegistry } from '@svx/common';

@Controller('packages')
export class PackagesController {
  @Get()
  list() {
    return PackageRegistry.all();
  }
}
