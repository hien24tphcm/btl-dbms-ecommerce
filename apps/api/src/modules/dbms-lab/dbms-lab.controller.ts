import { Controller, Get, Post } from '@nestjs/common';
import { DbmsLabService } from './dbms-lab.service';

@Controller('dbms-lab')
export class DbmsLabController {
  constructor(private readonly dbmsLabService: DbmsLabService) {}

  @Get('introspection')
  async getIntrospection() {
    return this.dbmsLabService.getDatabaseIntrospection();
  }

  @Post('integrity-check')
  async runIntegrityCheck() {
    return this.dbmsLabService.runIntegrityCheck();
  }
}
