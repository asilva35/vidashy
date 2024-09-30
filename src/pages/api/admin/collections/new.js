import { getToken } from 'next-auth/jwt';
import db from '@/utils/db';
import { sanitizeOBJ, generateUUID } from '@/utils/utils';

async function createRecord(record_request, organization_id, default_object) {
  const new_record = sanitizeOBJ({
    ...record_request,
    id: generateUUID(),
    organization_id,
    objects: [default_object],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const { client, database } = db.mongoConnect(process.env.MAIN_DB_NAME);
  const collectionDB = database.collection('collections');

  try {
    const record = await collectionDB.insertOne(new_record);
    await client.close();
    return { record };
  } catch (e) {
    return { record: {} };
  }
}

async function createDB(record_request, organization_id, default_object) {
  const new_record = {};
  new_record[default_object.columns[0].name] = generateUUID();
  new_record[default_object.columns[1].name] = '';
  const nameNewDB = `DB_${organization_id}_${record_request.name}`;
  const { client, database } = db.mongoConnect(nameNewDB);
  const collectionDB = database.collection(default_object.name);

  try {
    const record = await collectionDB.insertOne(new_record);
    await client.close();
    return { record };
  } catch (e) {
    return { record: {} };
  }
}

export default async function handler(req, res) {
  try {
    const token = await getToken({ req });

    if (!token) return res.status(401).send({ message: 'Not authorized' });

    if (token.role !== 'admin')
      return res.status(401).send({ message: 'User Not authorized' });

    const { record_request } = req.body;
    const { organization_id } = req.query;

    const validation = {};

    if (!record_request.name || record_request.name === '') {
      validation.name = 'Field Required';
    }
    if (!record_request.status || record_request.status === '') {
      validation.status = 'Field Required';
    }
    if (!organization_id || organization_id === '') {
      validation.organization_id = 'Field Required';
    }

    //EVALUATE IF VALIDATION IS NOT EMPTY
    if (Object.keys(validation).length > 0) {
      return res.status(500).send({
        message: 'Record could not be processed',
        validation,
      });
    }
    const default_object = {
      id: generateUUID(),
      name: 'Table01',
      columns: [
        { label: 'UID', name: '_uid', type: 'hidden', id: generateUUID() },
        { label: 'Name', name: 'Name', type: 'text', id: generateUUID() },
      ],
    };
    const record = await createRecord(
      record_request,
      organization_id,
      default_object
    );
    const dbCreated = await createDB(
      record_request,
      organization_id,
      default_object
    );

    if (!record || !dbCreated)
      return res
        .status(500)
        .send({ message: 'Record could not be processed ' });

    res.status(200).json({ record });
  } catch (error) {
    console.error('Error getting token or session:', error);
  }
}
