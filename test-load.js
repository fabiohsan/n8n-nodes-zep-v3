// Test script to simulate n8n loading the nodes
console.log('Testing n8n-nodes-zep-v3 package loading...\n');

// Test 1: Load credentials
console.log('1. Loading ZepApiV3 credentials...');
try {
  const creds = require('./dist/credentials/ZepApiV3.credentials.js');
  console.log('   ✓ Credentials loaded successfully');
  console.log('   Exports:', Object.keys(creds));
  
  // Check if it has the expected structure
  if (creds.ZepApiV3) {
    const instance = new creds.ZepApiV3();
    console.log('   ✓ Credential class instantiated');
    console.log('   Name:', instance.name);
    console.log('   Display Name:', instance.displayName);
  }
} catch (error) {
  console.error('   ✗ Error loading credentials:', error.message);
  console.error('   Stack:', error.stack);
}

console.log('\n2. Loading ZepMemoryV3 node...');
try {
  const memNode = require('./dist/nodes/ZepMemory/ZepMemory.node.js');
  console.log('   ✓ ZepMemory node loaded successfully');
  console.log('   Exports:', Object.keys(memNode));
  
  // Check if it has the expected structure
  if (memNode.ZepMemoryV3) {
    const instance = new memNode.ZepMemoryV3();
    console.log('   ✓ Node class instantiated');
    console.log('   Name:', instance.description.name);
    console.log('   Display Name:', instance.description.displayName);
    console.log('   Version:', instance.description.version);
  }
} catch (error) {
  console.error('   ✗ Error loading ZepMemory node:', error.message);
  console.error('   Stack:', error.stack);
}

console.log('\n3. Loading ZepVectorStoreV3 node...');
try {
  const vecNode = require('./dist/nodes/ZepVectorStore/ZepVectorStore.node.js');
  console.log('   ✓ ZepVectorStore node loaded successfully');
  console.log('   Exports:', Object.keys(vecNode));
  
  // Check if it has the expected structure
  if (vecNode.ZepVectorStoreV3) {
    const instance = new vecNode.ZepVectorStoreV3();
    console.log('   ✓ Node class instantiated');
    console.log('   Name:', instance.description.name);
    console.log('   Display Name:', instance.description.displayName);
    console.log('   Version:', instance.description.version);
  }
} catch (error) {
  console.error('   ✗ Error loading ZepVectorStore node:', error.message);
  console.error('   Stack:', error.stack);
}

console.log('\n4. Checking for deprecation warnings...');
console.log('   Run with: node --trace-deprecation test-load.js');

console.log('\n5. Package.json validation...');
const pkg = require('./package.json');
const issues = [];

if (!pkg.keywords || !pkg.keywords.includes('n8n-community-node-package')) {
  issues.push('Missing required keyword: n8n-community-node-package');
}

if (!pkg.n8n) {
  issues.push('Missing n8n configuration section');
} else {
  if (!pkg.n8n.n8nNodesApiVersion) {
    issues.push('Missing n8nNodesApiVersion');
  }
  if (!pkg.n8n.nodes || pkg.n8n.nodes.length === 0) {
    issues.push('No nodes defined in n8n section');
  }
  if (!pkg.n8n.credentials || pkg.n8n.credentials.length === 0) {
    issues.push('No credentials defined in n8n section');
  }
}

if (pkg.main) {
  issues.push('Package has "main" field (not needed for community nodes)');
}

if (!pkg.peerDependencies || !pkg.peerDependencies['n8n-workflow']) {
  issues.push('Missing peerDependencies for n8n-workflow');
}

if (issues.length === 0) {
  console.log('   ✓ Package.json structure is valid');
} else {
  console.log('   Issues found:');
  issues.forEach(issue => console.log('   - ' + issue));
}

console.log('\n✅ Test completed!');