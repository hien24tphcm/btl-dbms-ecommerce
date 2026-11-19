import { Module } from '@nestjs/common';
import { DbmsLabController } from './dbms-lab.controller';
import { DbmsLabService } from './dbms-lab.service';

@Module({
  controllers: [DbmsLabController],
  providers: [DbmsLabService],
  exports: [DbmsLabService],
})
export class DbmsLabModule {}
