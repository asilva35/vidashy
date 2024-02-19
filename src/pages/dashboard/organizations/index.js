import Layout from '@/components/Layout';
import Metaheader from '@/components/Metaheader';
import { ThemeContext } from '@/contexts/ThemeContext';
import React, { useContext, useEffect } from 'react';
import BreadCrumbs from '@/components/dashboard/BreadCrumbs';
import organizationModel from '@/models/organizationModel';
import MainScreenObject from '@/components/dashboard/MainScreenObject';

function ListOrganizations() {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const urlGetRecords = `${process.env.NEXT_PUBLIC_BASE_URL}/api/admin/organizations/list`;
  const urlNewRecord = `${process.env.NEXT_PUBLIC_BASE_URL}/api/admin/organizations/new`;
  const urlUpdateRecord = `${process.env.NEXT_PUBLIC_BASE_URL}/api/admin/organizations/update`;
  return (
    <>
      <Metaheader title="Organizations List | Vidashy" />
      <Layout theme={theme} toogleTheme={toggleTheme}>
        <BreadCrumbs
          theme={theme}
          data={{
            links: [
              { href: '/dashboard', title: 'Home' },
              { href: false, title: 'Organizations' },
            ],
          }}
        />
        <MainScreenObject
          urlGetRecords={urlGetRecords}
          urlNewRecord={urlNewRecord}
          urlUpdateRecord={urlUpdateRecord}
          tablePageSize={5}
          model={organizationModel}
          tableComponentData={{
            title: 'Organizations List',
            button: {
              label: 'New Organization',
            },
            columns: [
              { key: 'expand', label: '' },
              { key: 'id', label: 'Organization ID' },
              { key: 'name', label: 'Organization' },
              { key: 'date', label: 'Date' },
              { key: 'status', label: 'Status' },
            ],
          }}
          modalComponentData={{
            title: 'Organization Details',
          }}
          schema={{
            fields: [
              {
                key: 'id',
                label: 'Organization ID',
                type: 'hidden',
              },
              {
                key: 'name',
                label: 'Organization Name',
                type: 'text',
                isRequired: true,
              },
              {
                key: 'status',
                label: 'Status',
                type: 'select',
                isRequired: true,
                items: [
                  { value: 'active', label: 'Active' },
                  { value: 'inactive', label: 'Inactive' },
                ],
              },
            ],
          }}
        />
      </Layout>
    </>
  );
}

ListOrganizations.auth = { adminOnly: true };
export default ListOrganizations;
