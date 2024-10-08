import db from '@/utils/db';
import { consoleError } from './error';
import { createPresignedPost } from '@aws-sdk/s3-presigned-post';
import { S3Client } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import recordEmitter from '@/utils/Events';

async function getRecords(request) {
  const { organization, collection, object, params } = request;

  // const page = params.page ? parseInt(params.page) : 1;
  // const pageSize = params.pageSize ? parseInt(params.pageSize) : 10;
  let page = 1;
  let pageSize = 10;

  let query = {};

  let options = params.options;

  if (options) {
    options = options.replaceAll('"and":', '"$and":');
    options = options.replaceAll('"or":', '"$or":');
    options = options.replaceAll('"regex":', '"$regex":');
    options = options.replaceAll('"optionsRegex":', '"$options":');

    options = JSON.parse(options);
  }

  if (options && options.filter) {
    query = options.filter;
    page = options.page ? parseInt(options.page) : page;
    pageSize = options.pageSize ? parseInt(options.pageSize) : pageSize;
  } else {
    page = params.page ? parseInt(params.page) : 1;
    pageSize = params.pageSize ? parseInt(params.pageSize) : 10;
    const filterBy = params.filterBy ? params.filterBy.split(',') : [];
    const filterValue = params.filterValue ? params.filterValue.split(',') : [];
    const filterComparison = params.filterComparison
      ? params.filterComparison.split(',')
      : [];
    const filterCondition =
      params.filterCondition && params.filterCondition !== 'undefined'
        ? params.filterCondition
        : 'and';

    const filter = [];
    if (filterBy) {
      filterBy.map((item, index) => {
        filter.push({
          field: item,
          value: filterValue[index],
          comparison: filterComparison[index] ? filterComparison[index] : 'eq',
        });
      });
    }
    if (filterCondition === 'or') query = { $or: [] };
    else query = { $and: [] };

    filter.forEach((item) => {
      if (item.comparison === 'eq')
        query[`$${filterCondition}`].push({ [item.field]: item.value });
      else if (item.comparison === 'gt')
        query[`$${filterCondition}`].push({
          [item.field]: { $gt: item.value },
        });
      else if (item.comparison === 'lt')
        query[`$${filterCondition}`].push({
          [item.field]: { $lt: item.value },
        });
      else if (item.comparison === 'gte')
        query[`$${filterCondition}`].push({
          [item.field]: { $gte: item.value },
        });
      else if (item.comparison === 'lte')
        query[`$${filterCondition}`].push({
          [item.field]: { $lte: item.value },
        });
      else if (item.comparison === 'ne')
        query[`$${filterCondition}`].push({
          [item.field]: { $ne: item.value },
        });
      else if (item.comparison === 'in')
        query[`$${filterCondition}`].push({
          [item.field]: { $in: item.value.split('|') },
        });
      else if (item.comparison === 'nin')
        query[`$${filterCondition}`].push({
          [item.field]: { $nin: item.value.split('|') },
        });
      else if (item.comparison === 'regex') {
        query[`$${filterCondition}`].push({
          [item.field]: { $regex: item.value, $options: 'i' },
        });
      } else if (item.comparison === 'exists')
        query[`$${filterCondition}`].push({
          [item.field]: { $exists: item.value === 'true' },
        });
      else query[`$${filterCondition}`].push({ [item.field]: item.value });
    });

    if (query[`$${filterCondition}`].length === 0)
      delete query[`$${filterCondition}`];
  }

  let sortBy = [];
  let sortValue = [];

  if (options && options.sortBy) {
    sortBy = options.sortBy.split(',');
  } else if (params.sortBy) {
    sortBy = params.sortBy.split(',');
  }

  if (options && options.sortValue) {
    sortValue = options.sortValue.split(',');
  } else if (params.sortValue) {
    sortValue = params.sortValue.split(',');
  }

  const sort = [];
  if (sortBy) {
    sortBy.map((item, index) => {
      sort.push({
        field: item,
        value: sortValue.length >= index ? sortValue[index] : -1,
      });
    });
  }

  if (sort.length === 0) sort.push({ field: 'createdAt', value: -1 });

  let sortDB = {};
  sort.forEach((item) => {
    sortDB[item.field] = item.value;
  });

  let dataBaseName = `DB_${organization}_${collection}`;
  const skip = (page - 1) * pageSize;
  const { client, database } = db.mongoConnect(dataBaseName);

  const collectionDB = database.collection(object);

  const total = await collectionDB.countDocuments(query);
  const totalPages = Math.ceil(total / pageSize);
  const records = await collectionDB
    .find(query)
    .sort(sortDB)
    .skip(skip)
    .limit(pageSize)
    .toArray();

  await client.close();

  return { records, total, page, totalPages };
}

//CREATE RECORD FUNCTION
async function createRecord(request) {
  const { organization, collection, object, body } = request;
  let dataBaseName = `DB_${organization}_${collection}`;

  const { client, database } = db.mongoConnect(dataBaseName);

  const collectionDB = database.collection(object);

  //ADD TO BODY THE CREATEDAT AND UPDATEDAT FIELDS
  const new_record = {
    ...body,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    const record = await collectionDB.insertOne(new_record);
    await client.close();
    recordEmitter.emit('recordCreated', {
      dbResponse: record,
      organization,
      collection,
      object,
      new_record,
    });
    return { record };
  } catch (e) {
    return { record: {} };
  }
}

//DELETE RECORD FUNCTION
async function deleteRecord(request) {
  const { organization, collection, object, body } = request;
  let dataBaseName = `DB_${organization}_${collection}`;

  const { client, database } = db.mongoConnect(dataBaseName);

  const collectionDB = database.collection(object);

  if (!body || !body.id) return false;

  const id = body.id;

  try {
    try {
      // Delete the record
      const result = await collectionDB.deleteOne({ id });
      await client.close();
      if (result.deletedCount === 1) {
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error occurred while trying to delete document:', e);
      return { result: {} };
    }
  } catch (e) {
    return { record: {} };
  }
}

//UPDATE RECORD FUNCTION
async function updateRecord(request) {
  const { organization, collection, object, body } = request;
  let dataBaseName = `DB_${organization}_${collection}`;

  const { client, database } = db.mongoConnect(dataBaseName);

  const collectionDB = database.collection(object);

  const { id } = body;

  //ADD TO BODY THE UPDATEDAT FIELDS
  const update_record = {
    ...body,
    updatedAt: new Date().toISOString(),
  };

  const filter = { id };

  try {
    const record = await collectionDB.updateOne(filter, {
      $set: update_record,
    });

    await client.close();

    recordEmitter.emit('recordUpdated', {
      dbResponse: record,
      organization,
      collection,
      object,
      new_record: update_record,
    });

    return { record };
  } catch (e) {
    return { record: {} };
  }
}

//PREPARE UPLOAD
async function prepareUpload(request) {
  const { body } = request;

  const { filename, contentType } = body;

  try {
    const client = new S3Client({ region: process.env.AWS_REGION });
    const { url, fields } = await createPresignedPost(client, {
      Bucket: process.env.AWS_BUCKET_NAME,
      Key: uuidv4(),
      Conditions: [
        ['content-length-range', 0, 10485760], // up to 10 MB
        ['starts-with', '$Content-Type', contentType],
      ],
      Fields: {
        acl: 'public-read',
        'Content-Type': contentType,
      },
      Expires: 600, // Seconds before the presigned post expires. 3600 by default.
    });

    return { url, fields };
  } catch (error) {
    return {};
  }
}

export { getRecords, createRecord, deleteRecord, updateRecord, prepareUpload };
