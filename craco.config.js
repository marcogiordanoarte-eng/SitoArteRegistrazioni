// CRACO config to silence missing source map warnings from specific node_modules packages
module.exports = {
  webpack: {
    configure: (config) => {
      // Remove source-map-loader for problematic modules
      if (config.module && Array.isArray(config.module.rules)) {
        config.module.rules = config.module.rules.map(rule => {
          if (rule && rule.use) {
            const useArr = Array.isArray(rule.use) ? rule.use : [rule.use];
            const filtered = useArr.filter(u => {
              if (typeof u === 'string') return u !== 'source-map-loader';
              if (u && u.loader) return u.loader !== 'source-map-loader';
              return true;
            });
            return { ...rule, use: filtered };
          }
          return rule;
        });
      }
      // Alternative: ignore warnings via performance hints or stats
      config.ignoreWarnings = [/(Failed to parse source map)/];
      return config;
    }
  }
};
