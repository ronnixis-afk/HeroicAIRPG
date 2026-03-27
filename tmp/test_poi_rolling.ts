
import { POI_MATRIX } from './src/constants';

function testRolling() {
    const fantasyMatrix = POI_MATRIX.fantasy;
    const rolledThemes = [1, 2, 3].map(() => {
        const r1 = Math.floor(Math.random() * 10);
        const r2 = Math.floor(Math.random() * 10);
        const r3 = Math.floor(Math.random() * 10);
        return `${fantasyMatrix.baseTypes[r1]} | ${fantasyMatrix.modifiers[r2]} | ${fantasyMatrix.flavors[r3]}`;
    });
    console.log("Rolled Themes:", JSON.stringify(rolledThemes, null, 2));
}

testRolling();
