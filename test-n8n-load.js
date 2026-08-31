// Simulating n8n's package loading process
const path = require('path');
const fs = require('fs');

console.log('=== N8N Community Node Loading Test ===\n');

let hasErrors = false;

// 1. Check package.json structure
console.log('1. Checking package.json...');
const pkg = require('./package.json');

// Check required fields
const requiredFields = {
  name: pkg.name,
  version: pkg.version,
  keywords: pkg.keywords,
  'n8n section': pkg.n8n,
  'n8n.n8nNodesApiVersion': pkg.n8n?.n8nNodesApiVersion,
  'n8n.nodes': pkg.n8n?.nodes,
  'n8n.credentials': pkg.n8n?.credentials,
};

for (const [field, value] of Object.entries(requiredFields)) {
  if (!value) {
    hasErrors = true;
    console.error(`   ✗ Missing: ${field}`);
  } else {
    console.log(`   ✓ ${field}: ${JSON.stringify(value).substring(0, 50)}...`);
  }
}

// Check keyword
if (!pkg.keywords?.includes('n8n-community-node-package')) {
  hasErrors = true;
  console.error('   ✗ Missing required keyword: n8n-community-node-package');
} else {
  console.log('   ✓ Has required keyword: n8n-community-node-package');
}

// 2. Check if files exist
console.log('\n2. Checking if specified files exist...');
const basePath = __dirname;

// Check credentials
if (pkg.n8n?.credentials) {
  for (const credPath of pkg.n8n.credentials) {
    const fullPath = path.join(basePath, credPath);
    if (fs.existsSync(fullPath)) {
      console.log(`   ✓ Credential exists: ${credPath}`);

      // Try to load it
      try {
        const cred = require(fullPath);
        const className = Object.keys(cred)[0];
        console.log(`     → Exports: ${className}`);

        // Try to instantiate
        if (cred[className]) {
          const instance = new cred[className]();
          console.log(`     → Instance created successfully: ${instance.displayName}`);
        }
      } catch (err) {
        hasErrors = true;
        console.error(`     ✗ Error loading: ${err.message}`);
      }
    } else {
      hasErrors = true;
      console.error(`   ✗ Credential not found: ${credPath}`);
    }
  }
}

// Check nodes
if (pkg.n8n?.nodes) {
  for (const nodePath of pkg.n8n.nodes) {
    const fullPath = path.join(basePath, nodePath);
    if (fs.existsSync(fullPath)) {
      console.log(`   ✓ Node exists: ${nodePath}`);

      // Try to load it
      try {
        const nodeModule = require(fullPath);
        const classNames = Object.keys(nodeModule);
        console.log(`     → Exports: ${classNames.join(', ')}`);

        // Find the node class
        let foundNode = false;
        for (const name of classNames) {
          const NodeCls = nodeModule[name];
          if (typeof NodeCls === 'function') {
            const instance = new NodeCls();
            if (instance.description) {
              foundNode = true;
              console.log(`     → Node instantiated: ${instance.description.displayName} (${name})`);
              if (typeof instance.supplyData === 'function') {
                console.log(`     → Has supplyData handler (AI ready)`);
              }
              if (typeof instance.execute === 'function') {
                console.log(`     → Has execute handler`);
              }
            }
          }
        }

        if (!foundNode) {
          hasErrors = true;
          console.error(`     ✗ No node class with description property found`);
        }
      } catch (err) {
        hasErrors = true;
        console.error(`     ✗ Error loading: ${err.message}`);
      }
    } else {
      hasErrors = true;
      console.error(`   ✗ Node not found: ${nodePath}`);
    }
  }
}

// 3. Check for common issues
console.log('\n3. Checking for common issues...');

if (pkg.main) {
  const mainPath = path.join(basePath, pkg.main);
  if (fs.existsSync(mainPath)) {
    console.log(`   ✓ Main file exists: ${pkg.main}`);
  } else {
    hasErrors = true;
    console.error(`   ✗ Main file not found: ${pkg.main}`);
  }
}

// Check for runtime dependencies
if (pkg.dependencies && Object.keys(pkg.dependencies).length > 0) {
  console.warn(
    `   ⚠ Has runtime dependencies (not recommended for community nodes): ${Object.keys(
      pkg.dependencies,
    ).join(', ')}`,
  );
} else {
  console.log('   ✓ No runtime dependencies (verified node friendly)');
}

// Check peer dependencies
if (pkg.peerDependencies) {
  console.log(`   ✓ Has peer dependencies: ${Object.keys(pkg.peerDependencies).join(', ')}`);
}

if (hasErrors) {
  console.error('\n❌ N8N simulation failed');
  process.exit(1);
} else {
  console.log('\n=== ✅ All N8N Loading Tests Passed ===');
}