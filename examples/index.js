// const util = require('./dynamodb-utility');
const util = require('../dist');
const dataModel = new util.DynamodbUtil('FBW-Static-Data');

dataModel.scan().then(res => console.log(res));
