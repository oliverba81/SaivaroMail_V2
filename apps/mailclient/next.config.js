/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  modularizeImports: {
    'react-icons/fi': {
      transform: 'react-icons/fi/{{member}}',
    },
  },
  async redirects() {
    return [
      { source: '/emails/compose', destination: '/emails', permanent: false },
      { source: '/emails/compose/phone-note', destination: '/emails', permanent: false },
    ];
  },
};

module.exports = nextConfig;



