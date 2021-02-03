<a href="https://aws.amazon.com/dynamodb/"><img src="https://miro.medium.com/max/700/1*cmfoGi3FnVIBCwvmVLYgjg.png" title="AWS DynamoDB" alt="AWS_DynamoDB"></a>
[![Build Status](http://img.shields.io/travis/badges/badgerbadgerbadger.svg?style=flat-square)](https://rubygems.org/gems/badgerbadgerbadger) [![License](http://img.shields.io/:license-mit-blue.svg?style=flat-square)](http://badges.mit-license.org) 

---

## Table of Contents

- [Features](#features)
- [Installation](#installation)
- [Setup](#setup)
- [Usage](#usage)
- [Documentation](#documentation)

---
## Features
Basic DynamoDB operation in table
- get
- put
- update
- patch
- delete
- scan
- query
- raw

>*support dynamodb Comparison Operator and Function*

> *support nested attribute filter expression*

## Installation

```
$ npm install --save dynamodb-utility
```

### Setup

- **ตั้งค่า AWS IAM**
    - ตั้งค่า User และให้ policy ให้เรียบร้อย และนำใน AWS Access Key ID และ AWS Secret Access Key มาใช้
    
- **ตั้งค่า AWS Environment**
    - แนะนำให้ติดตั้ง AWS CLI และ Configuration Environment พื้นฐานให้เรียบร้อย
อ่านเพิ่มเติมเกี่ยวกับ [AWS Configure](https://docs.aws.amazon.com/cli/latest/userguide/cli-chap-configure.html)

- **ตรวจสอบ AWS Environment**
```
$ aws configure
AWS Access Key ID [None]: AKIAIOSFODNN7EXAMPLE
AWS Secret Access Key [None]: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
Default region name [None]: us-west-2
Default output format [None]: json
```

---

## Example Code
สามารถดูตัวอย่างการเขียนได้ที่

[example code](https://github.com/viruskizz/dynamodb-utility/tree/master/examples)

---

## Usage
โดยพื้นฐานแล้ว Library จะใช้ AWS Environment ที่อยู่บนเครื่องในการตั้งค่า AWS DynamoDB ใน Module
```
import DynamodbUtil from 'dynamodb-utility'
const userModel = new DynmodbUtil('User-Table', {
    region: 'ap-southeast-1',
    // ...DynamoDBUtilOptions
});
```

Put
```
userModel.put({
    pkey: 'User1',
    skey: 'Profile',
    firstname: 'Araiva',
    lastname: 'Viruskizz',
    gender: 'Male',
    age: 20,
    address: {
        province: 'London',
        country: 'England'
    }
}).then(res => console.log(res));
```

Get
```
userModel.get({ pkey: 'User1', skey: 'Profile'})
    .then(res => console.log(res));
```

Update
```
userModel.update({ id: 'User1', skey: 'Profile'}, {
    age: 20
}).then(res => console.log(res));
```

Patch
```
userModel.patch({ id: 'User1', skey: 'Profile'}, {
    age: 20,
    'address.province': 'Man Chester'
}).then(res => console.log(res));
```

Delete
```
userModel.delete({ pkey: 'User1', skey: 'Profile' })
    .then(res => console.log(res));
```

Scan
```
userModel.scan().then(res => console.log(res));

// or by pass argument scan option
// DynamodbUtil.query(ScanOptions);
userModel.scan({
    filter: {
        gender: 'Male',
        age: {
            greaterThan: 10
        },
        'address.country': 'England'
    },
    attributes: ['firstname', 'lastname', 'age']
}).then(res => console.log(res));
```

Query
```
// DynamodbUtil.query(QueryOptions);
userModel.query({
    keyCondition: {
        pkey: 'User1',
        skey: {
            beginsWith: 'Profile'
        }
    }
}).then(res => console.log(res));
```

Raw (Use Raw DynamodbClient)
```
// DynamodbUtil.raw.scan(ScanParam);
userModel.raw.scan({
    Table: 'User-Table'
}).promise().then(res => console.log(res.Items));
```

## Attribute Reference
DynamoDBUtilOptions

| Variable        | Type          | Required  | Default  |
| --------------- |:-------------:| ---------:| --------:|
| region          | string        | false     | env: `AWS_REGION` |
| timestamp       | boolean       | false     | NO|
| accessKeyIds    | string        | false     | env: `AWS_ACCESS_KEY`|
| secretAccessKey | string        | false     | env: `AWS_SECRET_KEY`|

ScanOptions

| Variable        | Type            | Required  | Description  |
| --------------- |:---------------:| ---------:| --------:|
| filter         | KeyCondition     | true      | เงื่อนไขการกรอง ดู KeyCondition เพิ่มเติม|
| limit          | string           | false     | จำกัดจำนวนผลลัพธ์ |
| lastKey        | boolean          | false     | Key สุดท้ายเพื่อทำ Pagination |
| times          | string           | false     | จำนวนรอบของการแสกน |
| indexName      | string           | false     | ชื่อ index กรณีใช้ GSI หรือ LSI|
| attributes     | Array<string>    | false     | Attribute ที่ต้องการเลือกออกมาแสดง|

QueryOptions  *(extended from ScanOptions)*

| Variable        | Type            | Required  | Description  |
| --------------- |:---------------:| ---------:| --------:|
| keyCondition    | KeyCondition     | false    | เงื่อนไขการ Query ดู KeyCondition เพิ่มเติม|
| filter          | KeyCondition     | false    | เงื่อนไขการกรอง ดู KeyCondition เพิ่มเติม|
| sort            | 'DESC' or 'ASC'  | false    | เรียงลำดับตาม sort key ,default: ASC

KeyCondition

```
Attribute: 'Value'
  
Or 
  
Attribute: {
    ConditionFunction: 'Value'
}
```
ConditionFunction ที่สามารถเรียกใช้งานได้
- equal
- greaterThan
- lessThan
- attributeExists
- attributeNotExists
- beginsWith
- contains

ดูรายละเอียดเพิ่มเติ่ม [Comparison Operator and Function Reference
](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Expressions.OperatorsAndFunctions.html)

## Contributors

> Or Contributors/People

| <a href="http://https://github.com/viruskizz" target="_blank">**Araiva Viruskizz**</a> |
| :---: 
| [![viruskizz](https://avatars1.githubusercontent.com/u/20396530?s=150&u=1dd265ad5ff5aff48f1eed6b5e6575d66e28c94f&v=4)](http://https://github.com/viruskizz)

---

## Support

Reach out to me at one of the following places!

- Website at <a href="http://developer.fbw.center" target="_blank">`developer.fbw.center`</a>
- Facebook at <a href="https://facebook.com/ceremonial.statistic.center/" target="_blank">`ceremonial.statistic.center`</a>

---

## License

[![License](http://img.shields.io/:license-mit-blue.svg?style=flat-square)](http://badges.mit-license.org)

- **[MIT license](http://opensource.org/licenses/mit-license.php)**
- Copyright 2015 © <a href="http://developer.fbw.center" target="_blank">Lightmatter Team</a>.
