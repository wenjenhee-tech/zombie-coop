module.exports = {
  define: {
    __API_URL__: JSON.stringify(process.env.VITE_API_URL || 'https://zombie-coop-production.up.railway.app')
  }
}
