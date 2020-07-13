
import {DynamodbUtil} from 'dynamodb-utility';

const dataModel = new DynamodbUtil('Static-Data');

dataModel.scan().then(res => {
  console.log(res);
})
