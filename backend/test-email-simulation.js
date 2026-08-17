import { RechargeController } from './recharge-controller.js';

async function runTest() {
    console.log("🧪 =========================================================");
    console.log("🧪 PRUEBA DE SIMULACIÓN DE CONCILIACIÓN LEMON CASH");
    console.log("🧪 =========================================================\n");

    const testAmount = process.argv[2] ? parseFloat(process.argv[2]) : 10.45;
    const testSender = process.argv[3] || '$cliente_vip';
    const testRef = `OP_${Date.now()}`;
    const testMessageId = `test_msg_${Date.now()}`;

    console.log(`📨 Simulando correo entrante de Lemon Cash:`);
    console.log(`   Monto: $${testAmount}`);
    console.log(`   De: ${testSender}`);
    console.log(`   Referencia: ${testRef}`);
    console.log(`   Message-ID: ${testMessageId}\n`);

    try {
        const result = await RechargeController.processLemonTransfer({
            amount: testAmount,
            sender: testSender,
            reference: testRef,
            date: new Date(),
            emailMessageId: testMessageId,
            rawSnippet: `¡Recibiste $${testAmount} de ${testSender}! ID de Operación: ${testRef}`
        });

        console.log("\n📊 Resultado de la conciliación:");
        console.log(JSON.stringify(result, null, 2));

        if (result.success) {
            console.log("\n✅ ¡ÉXITO! La orden fue conciliada y el saldo acreditado correctamente.");
        } else {
            console.log(`\n⚠️ No se acreditó: ${result.reason}`);
            console.log("   (Asegúrate de tener una orden 'pending' creada con este monto exacto antes de ejecutar).");
        }
    } catch (error) {
        console.error("❌ Error ejecutando prueba:", error);
    }

    process.exit(0);
}

runTest();
