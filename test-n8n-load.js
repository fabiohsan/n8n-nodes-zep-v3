// Simulating n8n's package loading process
const path = require('path');
const fs = require('fs');

console.log('=== N8N Community Node Loading Test ===\n');

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
  'n8n.credentials': pkg.n8n?.credentials
};

for (const [field, value] of Object.entries(requiredFields)) {
  if (!value) {
    console.error(`   ✗ Missing: ${field}`);
  } else {
    console.log(`   ✓ ${field}: ${JSON.stringify(value).substring(0, 50)}...`);
  }
}

// Check keyword
if (!pkg.keywords?.includes('n8n-community-node-package')) {
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
          console.log(`     → Instance created successfully`);
        }
      } catch (err) {
        console.error(`     ✗ Error loading: ${err.message}`);
      }
    } else {
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
        const node = require(fullPath);
        const className = Object.keys(node)[0];
        console.log(`     → Exports: ${className}`);
        
        // Try to instantiate
        if (node[className]) {
          const instance = new node[className]();
          console.log(`     → Instance created successfully`);
          
          // Check required properties
          if (!instance.description) {
            console.error(`     ✗ Missing description property`);
          } else {
            console.log(`     → Has description: ${instance.description.displayName}`);
          }
        }
      } catch (err) {
        console.error(`     ✗ Error loading: ${err.message}`);
      }
    } else {
      console.error(`   ✗ Node not found: ${nodePath}`);
    }
  }
}

// 3. Check for common issues
console.log('\n3. Checking for common issues...');

// Check if main field points to existing file
if (pkg.main) {
  const mainPath = path.join(basePath, pkg.main);
  if (fs.existsSync(mainPath)) {
    console.log(`   ✓ Main file exists: ${pkg.main}`);
  } else {
    console.error(`   ✗ Main file not found: ${pkg.main}`);
  }
}

// Check for runtime dependencies
if (pkg.dependencies && Object.keys(pkg.dependencies).length > 0) {
  console.warn(`   ⚠ Has runtime dependencies (not allowed for verified nodes): ${Object.keys(pkg.dependencies).join(', ')}`);
} else {
  console.log('   ✓ No runtime dependencies (good for verification)');
}

// Check peer dependencies
if (pkg.peerDependencies) {
  console.log(`   ✓ Has peer dependencies: ${Object.keys(pkg.peerDependencies).join(', ')}`);
}

// 4. Try to load as n8n would
console.log('\n4. Simulating n8n loading process...');
try {
  // n8n would check if the package exports are valid
  const nodeClasses = [];
  const credentialClasses = [];
  
  // Load all nodes
  if (pkg.n8n?.nodes) {
    for (const nodePath of pkg.n8n.nodes) {
      const fullPath = path.join(basePath, nodePath);
      const nodeModule = require(fullPath);
      const className = Object.keys(nodeModule)[0];
      if (nodeModule[className]) {
        nodeClasses.push(className);
      }
    }
  }
  
  // Load all credentials
  if (pkg.n8n?.credentials) {
    for (const credPath of pkg.n8n.credentials) {
      const fullPath = path.join(basePath, credPath);
      const credModule = require(fullPath);
      const className = Object.keys(credModule)[0];
      if (credModule[className]) {
        credentialClasses.push(className);
      }
    }
  }
  
  console.log(`   ✓ Successfully loaded ${nodeClasses.length} nodes: ${nodeClasses.join(', ')}`);
  console.log(`   ✓ Successfully loaded ${credentialClasses.length} credentials: ${credentialClasses.join(', ')}`);
  
} catch (error) {
  console.error(`   ✗ Loading failed: ${error.message}`);
  console.error(`   Stack: ${error.stack}`);
}

console.log('\n=== Test Complete ===');