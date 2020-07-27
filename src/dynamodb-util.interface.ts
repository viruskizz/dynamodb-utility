export interface ScanQueryOptions {

  // @ApiProperty({description: 'จำนวนข้อมูลที่ดึง', example: 100, required: false})
  limit?: number;

  // @ApiProperty({description: 'Key สุดท้ายของข้อมูลล่าสุดเพื่อนำไปใช้ดึงข้อมูลหน้าถัดไป', required: false})
  lastKey?: object;

  // @ApiProperty({description: 'จำนวนรอบของการ query หรือ scan', example: 1, required: false})
  times?: number;

  // @ApiProperty({description: 'filter scan กรองข้อมูลทั้งหมด', example: '{"firstname": "test"}', required: false})
  filter?: {
    [x: string]: string,
  };

  // @ApiProperty({description: 'กรองเฉพาะ Attributes ที่ต้องการจะนำมาใช้', example: 'id, firstname, lastname', required: false})
  attributes?: string;

  // @ApiProperty({description: 'แสดงรายละเอียดของข้อมูลทั้งหมด ถ้าดึงปริมาณมากจะทำให้ได้ข้อมูลช้าลง', example: 'true', required: false})
  includeDetails?: string | boolean;
}


export interface DynamoDBUtilOptions {
  region?: string;
  timestamp?: boolean;
  accessKeyId?: string;
  secretAccessKey?: string;
}

// Interface is below
export interface ScanOptions {
  limit?: number;
  lastKey?: object;
  times?: number;
  indexName?: string,
  filter?: KeyCondition;
  attributes?: string[];
}

export interface QueryOptions extends  ScanOptions {
  keyCondition: KeyCondition;
  sort?: 'DESC' | 'ASC' | string;
}

export type ConditionFunction =
  'equal' |
  'greaterThan' |
  'lessThan' |
  'attributeExists' |
  'attributeNotExists' |
  'beginsWith' |
  'contains'

export type KeyCondition = {
  [x: string]: {
    [cnfn in ConditionFunction | string]: string | null
  } | string,
}
