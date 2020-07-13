
const util = require('dynamodb-utility');

const dataModel = new util.DynamodbUtil('Static-Data');

dataModel.scan().then(res => {
  console.log(res);
})
