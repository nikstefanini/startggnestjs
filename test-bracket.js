const { BracketsManager } = require('brackets-manager');
const { JsonDatabase } = require('brackets-json-db');

async function testBracket() {
  try {
    console.log('Inicializando brackets-manager...');
    const storage = new JsonDatabase();
    const manager = new BracketsManager(storage);
    
    console.log('Manager inicializado correctamente');
    
    const stageConfig = {
      tournamentId: 1,
      name: 'Test Tournament',
      type: 'single_elimination',
      seeding: ['Player 1', 'Player 2', 'Player 3', 'Player 4'],
      settings: {
        seedOrdering: ['natural'],
        balanceByes: true
      }
    };
    
    console.log('Configuración del stage:', JSON.stringify(stageConfig, null, 2));
    
    console.log('Creando stage...');
    const stage = await manager.create.stage(stageConfig);
    
    console.log('Stage creado exitosamente:', stage);
    
    // Obtener matches
    const matches = await manager.get.stageMatches(stage.id);
    console.log('Matches creados:', matches.length);
    
  } catch (error) {
    console.error('Error en test:', error);
    console.error('Stack trace:', error.stack);
  }
}

testBracket();