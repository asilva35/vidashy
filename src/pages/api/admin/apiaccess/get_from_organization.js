import { getToken } from 'next-auth/jwt';
import db from '@/utils/db';

async function getRecord(organization_id) {
  const { client, database } = db.mongoConnect(process.env.MAIN_DB_NAME);

  let query = { organization_id };

  const collectionDB = database.collection('apiaccess');

  const records = await collectionDB
    .find(query)
    .sort({ createdAt: -1 })
    .toArray();

  await client.close();

  return { records };
}

export default async function handler(req, res) {
  try {
    const token = await getToken({ req });

    if (!token) return res.status(401).send({ message: 'Not authorized' });

    if (token.role !== 'admin')
      return res.status(401).send({ message: 'User Not authorized' });

    const { organization_id } = req.query;

    const data = await getRecord(organization_id);

    if (!data || !data.records || data.records.length === 0)
      return res.status(404).send({ data, message: 'Records Not found' });

    //REMOVE SENSIBLE DATA OF RECORDS
    data.records.map((_record) => {
      delete _record._id;
      delete _record.updatedAt;
    });

    res.status(200).json({ data });
  } catch (error) {
    console.error('Error getting token or session:', error);
  }
}