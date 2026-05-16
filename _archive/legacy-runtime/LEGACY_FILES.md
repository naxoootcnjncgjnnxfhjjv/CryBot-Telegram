# Deprecated Root Runtime Files

The following root-level files are legacy migration references only:

- `server-express.js`
- `config.js`
- `improved_index.js`

Production runtime must use:

```txt
src/index.js
```

Production config must use:

```txt
src/core/config.js
```

These files must not be used as Railway start commands.
