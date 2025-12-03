# Private Markets: Prediction Markets Privados con Aztec

## README para Presentacion (Diapositivas)

**Audiencia:** Desarrolladores, inversores, entusiastas crypto
**Duracion sugerida:** 15-20 minutos
**Enfoque:** Como funciona un prediction market + como Aztec habilita privacidad

---

# SECCION 1: INTRODUCCION A PREDICTION MARKETS

## Que es un Prediction Market?

Un prediction market es un mercado donde los participantes apuestan sobre el resultado de eventos futuros. A diferencia de las apuestas tradicionales, los prediction markets agregan informacion colectiva y han demostrado ser sorprendentemente precisos en predecir resultados.

### Ejemplos de Preguntas de Mercado

- "Bitcoin llegara a $100,000 antes del 31 de diciembre de 2025?"
- "Quien ganara las elecciones presidenciales de USA 2028?"
- "La Reserva Federal bajara las tasas de interes en Q1 2025?"
- "Ethereum 2.0 tendra mas de 1M de validadores en 2025?"

### Como Funcionan los Odds

En un prediction market tipico:
- Si crees que el evento ocurrira, compras acciones "YES"
- Si crees que NO ocurrira, compras acciones "NO"
- El precio de cada accion refleja la probabilidad percibida

**Ejemplo:**
```
Mercado: "ETH llegara a $5000 en 2025?"
- Precio YES: $0.65 (mercado cree 65% probabilidad)
- Precio NO: $0.35 (mercado cree 35% probabilidad)

Si compras YES a $0.65 y el evento ocurre:
  - Recibes $1.00
  - Ganancia: $0.35 (54% ROI)

Si no ocurre:
  - Pierdes tu apuesta de $0.65
```

---

## El Problema: Prediction Markets Tradicionales son PUBLICOS

### Problemas de Privacidad

1. **Tu identidad es publica**
   - Todos pueden ver que apostaste
   - Tu historial de apuestas es rastreable
   - Linkable a tu identidad real via KYC

2. **Tus posiciones son publicas**
   - Otros pueden ver cuanto apostaste
   - Pueden front-runnear tu posicion
   - Tu estrategia de trading es visible

3. **Informacion sensible expuesta**
   - Apuestas sobre elecciones? Tu inclinacion politica es publica
   - Apuestas sobre tu empresa? Posible insider trading visible
   - Apuestas sobre eventos personales? Tu vida privada expuesta

### Problemas Tecnicos

1. **Front-running**
   - Bots ven tu transaccion pendiente
   - Ejecutan antes que tu
   - Tu obtienes peores odds

2. **MEV (Maximal Extractable Value)**
   - Validadores reordenan transacciones
   - Extraen valor de usuarios
   - Prediction markets son targets perfectos

3. **Censura**
   - Mercados sobre temas controversiales pueden ser censurados
   - Plataformas centralizadas pueden bloquear usuarios
   - Sin resistencia a censura real

---

## La Solucion: Private Markets con Aztec

### Que es Aztec?

Aztec es una blockchain Layer 2 sobre Ethereum que proporciona **privacidad programable** usando zero-knowledge proofs (ZK-proofs).

**Caracteristicas clave:**
- Transacciones encriptadas por defecto
- Contratos inteligentes privados (Noir language)
- Compatibilidad con Ethereum
- Ejecuta logica compleja de forma privada

### Como Aztec Resuelve los Problemas

| Problema | Solucion Aztec |
|----------|----------------|
| Identidad publica | Transacciones anonimas, sin linkabilidad |
| Posiciones visibles | Montos encriptados, solo tu puedes ver |
| Front-running | No hay mempool publico, transacciones encriptadas |
| MEV | Validadores no pueden ver contenido de txs |
| Censura | Datos encriptados, imposible censurar selectivamente |

---

# SECCION 2: ARQUITECTURA DE PRIVATE MARKETS

## Vision General

Private Markets V3 es un sistema de prediction markets cross-chain que combina:

```
+------------------+     +------------------+     +------------------+
|     AZTEC        |     |    WORMHOLE      |     |    ARBITRUM      |
|   (Privacidad)   | --> |   (Mensajeria)   | --> |  (Settlement)    |
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
| - Apuestas       |     | - VAA Messages   |     | - Estado mercado |
|   privadas       |     | - Guardian       |     | - Calculo payout |
| - Claims         |     |   signatures     |     | - Custodia USDC  |
|   privados       |     | - Cross-chain    |     | - Anti-replay    |
|                  |     |                  |     |                  |
+------------------+     +------------------+     +------------------+
```

## Por que Arquitectura Hibrida?

### Aztec para Privacidad (Apuestas y Claims)

**Ventajas:**
- Montos de apuesta encriptados
- Identidad del apostador oculta
- Link entre apuesta y claim imposible de rastrear
- Zero-knowledge proofs garantizan integridad

**Limitaciones:**
- Aztec testnet todavia en desarrollo
- No tiene tokens "reales" (solo testnet)
- Interoperabilidad limitada

### Arbitrum para Settlement (Pagos y Estado)

**Ventajas:**
- Tokens reales (USDC)
- Liquidez existente
- Infraestructura madura
- Gas fees bajos
- Compatibilidad EVM completa

**Limitaciones:**
- Transacciones publicas
- No hay privacidad nativa

### Wormhole para Messaging (Puente)

**Ventajas:**
- Mensajeria cross-chain trustless
- 19 Guardians firman mensajes
- No requiere confianza en terceros
- Soporta cualquier data (no solo tokens)

---

## Stack Tecnologico Completo

```
FRONTEND (Next.js 15)
├── Aztec.js - Interaccion con Aztec
├── Viem - Interaccion con EVM
├── PXE (Private Execution Environment) - Corre en browser
└── Wallet Integration - Metamask + Aztec wallet

AZTEC CONTRACTS (Noir)
├── BetVault.nr - Almacena apuestas privadas
├── Token.nr - Token de testnet (AUSD)
└── Wormhole.nr - Emite mensajes cross-chain

WORMHOLE
├── Guardian Network - 19 validadores
├── VAA (Verifiable Action Approval) - Mensajes firmados
└── Relayer - Entrega mensajes entre chains

ARBITRUM CONTRACTS (Solidity)
├── WormholeReceiver.sol - Recibe y verifica VAAs
├── PredictionMarketCore.sol - Logica de mercados
└── Treasury.sol - Custodia USDC
```

---

# SECCION 3: FLUJO DE APUESTAS PRIVADAS

## Paso 1: Usuario Coloca Apuesta en Aztec

```
Usuario quiere apostar 100 USDC en "YES"

1. Usuario genera un SECRET aleatorio (254 bits)
   secret = random_field()

2. Usuario genera COMMITMENT
   commitment = poseidon_hash(market_id, amount, secret)

3. Transaccion PRIVADA en Aztec:
   - Transfiere 100 AUSD de forma privada
   - Crea BetNote encriptado (solo usuario puede leer)
   - Emite mensaje Wormhole con datos agregados

4. Lo que queda encriptado:
   - Identidad del usuario
   - Monto exacto
   - El secret

5. Lo que se envia a Arbitrum (via Wormhole):
   - market_id
   - bet_id (hash unico)
   - outcome (YES/NO)
   - amount
```

### Codigo del Contrato BetVault (Simplificado)

```noir
#[private]
fn bet(
    market_id: Field,
    outcome: u8,        // 0=NO, 1=YES
    amount: u128,
    commitment: Field,  // hash(market_id, amount, secret)
    bet_id: Field,
) {
    // 1. Transferir tokens de forma PRIVADA
    Token::transfer_private_to_private(from, admin, amount);

    // 2. Crear nota privada (encriptada)
    let bet_note = BetNote::new(from, market_id, outcome, amount, bet_id, commitment);
    storage.user_bets.at(from).insert(bet_note);

    // 3. Crear mensaje para Wormhole
    let payload = create_bet_payload(market_id, bet_id, outcome, amount);

    // 4. Publicar mensaje cross-chain
    Wormhole::publish_message(payload);
}
```

---

## Paso 2: Mensaje Viaja via Wormhole

```
AZTEC                    WORMHOLE                   ARBITRUM
  |                         |                          |
  | emit_public_log()       |                          |
  |------------------------>|                          |
  |                         |                          |
  |                    Guardians observan              |
  |                    19 firmas requeridas            |
  |                         |                          |
  |                         | VAA firmado              |
  |                         |------------------------->|
  |                         |                          |
  |                         |              Relayer entrega VAA
  |                         |              WormholeReceiver.verify()
  |                         |                          |
```

### Formato del Mensaje BET (98 bytes)

```
Byte 0:       0x01 (tipo de mensaje = BET)
Bytes 1-32:   market_id (Field, big-endian)
Bytes 33-64:  bet_id (Field, big-endian)
Byte 65:      outcome (0=NO, 1=YES)
Bytes 66-97:  amount (u128 como Field, big-endian)
```

---

## Paso 3: Arbitrum Procesa la Apuesta

```solidity
contract WormholeReceiver {
    function receiveWormholeMessages(bytes[] memory vaas) external {
        // 1. Verificar firmas de Guardians
        IWormhole.VM memory vm = wormhole.parseAndVerifyVM(vaas[0]);

        // 2. Verificar emitter es nuestro contrato Aztec
        require(registeredSenders[vm.emitterChainId] == vm.emitterAddress);

        // 3. Parsear payload
        bytes memory payload = vm.payload;
        uint8 messageType = uint8(payload[0]);

        if (messageType == 0x01) {
            // BET message
            _processBetPayload(payload);
        }
    }

    function _processBetPayload(bytes memory payload) internal {
        // Extraer datos
        bytes32 marketId = bytes32(payload[1:33]);
        bytes32 betId = bytes32(payload[33:65]);
        bool outcome = payload[65] == 0x01;
        uint256 amount = uint256(bytes32(payload[66:98]));

        // Actualizar estado del mercado
        predictionMarket.processBet(marketId, betId, outcome, amount);
    }
}

contract PredictionMarketCore {
    function processBet(uint256 marketId, bytes32 betId, bool outcome, uint256 amount) external {
        // Anti-replay: verificar bet_id no procesado
        require(!processedBets[betId], "Already processed");
        processedBets[betId] = true;

        // Actualizar totales
        if (outcome) {
            markets[marketId].yesTotal += amount;
        } else {
            markets[marketId].noTotal += amount;
        }

        emit BetProcessed(marketId, betId, outcome, amount);
    }
}
```

---

# SECCION 4: FLUJO DE CLAIMS PRIVADOS

## El Problema del Claim

Cuando el usuario quiere reclamar su ganancia, necesitamos:
1. Probar que hizo una apuesta ganadora
2. Sin revelar cual apuesta fue (privacy)
3. Sin permitir doble-claim (anti-replay)

## Solucion: Nullifiers

Un **nullifier** es un hash unico que:
- Se deriva de la apuesta original
- No puede ser revertido a la apuesta
- Permite verificar sin revelar

### Formula del Nullifier

```noir
nullifier = poseidon2_hash([market_id, commitment, recipient])
```

**Propiedades:**
- Deterministico (mismos inputs = mismo nullifier)
- One-way (no puedes obtener commitment del nullifier)
- Unico por combinacion (market, commitment, recipient)

---

## Flujo de Claim

```
Usuario quiere reclamar ganancia

1. Usuario en Aztec llama authorizeClaim():
   - Input: market_id, commitment, SECRET, recipient, amount

2. Contrato verifica:
   - commitment == hash(market_id, amount, SECRET) ✓
   - El secret es valido

3. Genera nullifier:
   - nullifier = hash(market_id, commitment, recipient)

4. Verifica nullifier no usado (anti-replay)

5. Emite mensaje Wormhole CLAIM_AUTH:
   - market_id
   - nullifier
   - bet_amount
   - recipient

6. Arbitrum recibe y:
   - Verifica nullifier no consumido
   - Calcula payout con formula pari-mutuel
   - Transfiere USDC al recipient
```

### Codigo authorizeClaim (Simplificado)

```noir
#[private]
fn authorizeClaim(
    market_id: Field,
    commitment: Field,
    secret: Field,
    recipient: AztecAddress,
    amount: u128,
) {
    // 1. Verificar que el commitment es valido
    let calculated = poseidon2_hash([market_id, amount as Field, secret]);
    assert(commitment == calculated, "Invalid secret");

    // 2. Generar nullifier
    let nullifier = poseidon2_hash([market_id, commitment, recipient.to_field()]);

    // 3. Marcar nullifier como usado (anti-replay)
    BetVault::_mark_claim_processed(commitment, nullifier).enqueue();

    // 4. Crear payload para Arbitrum
    let payload = create_claim_payload(market_id, nullifier, amount, recipient);

    // 5. Enviar via Wormhole
    Wormhole::publish_message(payload);
}
```

---

## Calculo de Payout: Formula Pari-Mutuel

### Que es Pari-Mutuel?

En un sistema pari-mutuel, todos los apostadores comparten el pool total. No hay "casa" que tome riesgo.

### Formula

```
payout = (bet_amount * total_pool) / winning_total

Donde:
- bet_amount: Lo que aposto el usuario
- total_pool: Colateral total del mercado (depositado por el creador)
- winning_total: Suma de todas las apuestas en el lado ganador
```

### Ejemplo Detallado

```
MERCADO: "Bitcoin > $100k en 2025?"

Creacion del mercado:
- El creador deposita 1,000 USDC como colateral (total_pool)

Apuestas recibidas:
- Alice apuesta 200 USDC en YES
- Bob apuesta 300 USDC en YES
- Carol apuesta 500 USDC en YES
- Dave apuesta 100 USDC en NO
- Eve apuesta 200 USDC en NO

Totales:
- yesTotal = 200 + 300 + 500 = 1,000 USDC
- noTotal = 100 + 200 = 300 USDC

ESCENARIO 1: YES gana (Bitcoin > $100k)
- winning_total = 1,000 USDC (yesTotal)
- Alice payout = (200 * 1000) / 1000 = 200 USDC (break even)
- Bob payout = (300 * 1000) / 1000 = 300 USDC (break even)
- Carol payout = (500 * 1000) / 1000 = 500 USDC (break even)

Espera... los YES apenas recuperan su apuesta?
Si, porque apostaron mas que el pool total!

ESCENARIO 2: NO gana (Bitcoin <= $100k)
- winning_total = 300 USDC (noTotal)
- Dave payout = (100 * 1000) / 300 = 333.33 USDC (+233% profit!)
- Eve payout = (200 * 1000) / 300 = 666.67 USDC (+233% profit!)

Los NO obtienen mucho mas porque apostaron menos!
```

### Ventajas del Pari-Mutuel

1. **Sin oracle de odds** - El mercado determina los odds
2. **Sin riesgo para creador** - Solo provee liquidez
3. **Simple on-chain** - Una division
4. **Siempre paga exactamente total_pool** - No mas, no menos

---

# SECCION 5: GARANTIAS DE PRIVACIDAD

## Que Queda Privado?

| Dato | En Aztec | En Wormhole | En Arbitrum |
|------|----------|-------------|-------------|
| Identidad usuario | PRIVADO | N/A | N/A |
| Monto individual | PRIVADO | Visible en VAA | Visible |
| Secret | PRIVADO | Nunca sale | Nunca sale |
| Commitment | PRIVADO | Nunca sale | Nunca sale |
| Nullifier | N/A | Visible | Visible |
| Link apuesta-claim | IMPOSIBLE | IMPOSIBLE | IMPOSIBLE |

## El Punto Clave: Unlinkability

Aunque el monto es visible en Arbitrum, **no se puede vincular a la identidad del usuario**:

```
APUESTA (Aztec privado):
- Usuario: Alice (0x123...)
- Monto: 100 USDC
- Commitment: hash(market, 100, secret_alice)

CLAIM (Arbitrum publico):
- Recipient: 0xABC... (puede ser diferente a Alice!)
- Nullifier: hash(market, commitment, recipient)
- Monto: 100 USDC

NO HAY FORMA de saber que:
- Alice hizo la apuesta original
- 0xABC es el mismo o diferente a Alice
- Cual commitment corresponde a cual nullifier
```

## Porque el Nullifier es Seguro?

```
nullifier = poseidon2_hash([market_id, commitment, recipient])

Para encontrar commitment desde nullifier:
- Necesitas invertir poseidon2_hash (imposible, es one-way)
- 2^254 posibles valores de commitment
- Brute force inviable

Para linkear apuesta con claim:
- Necesitas conocer el secret del usuario
- El secret NUNCA sale del dispositivo del usuario
- Solo el usuario puede generar el nullifier correcto
```

---

# SECCION 6: PROTECCION ANTI-REPLAY

## Por que es Importante?

Sin proteccion anti-replay, un atacante podria:
1. Interceptar un mensaje de apuesta y reenviarlo multiples veces
2. Reclamar la misma ganancia multiples veces
3. Drenar el treasury

## Proteccion de 3 Niveles

### Nivel 1: Aztec (Sender Side)

```noir
// En BetVault
storage.processed_bets.at(bet_id).write(true);  // Marca bet_id como procesado

// En authorizeClaim
storage.used_nullifiers.at(nullifier).write(true);  // Marca nullifier como usado
storage.claimed_commitments.at(commitment).write(true);  // Marca commitment como reclamado
```

### Nivel 2: Wormhole (Transport)

```
Cada VAA tiene un deliveryHash unico
WormholeReceiver trackea:
- processedMessages[deliveryHash] = true

El mismo VAA no puede ser procesado dos veces
```

### Nivel 3: Arbitrum (Receiver Side)

```solidity
// Para apuestas
mapping(bytes32 => bool) processedBets;
require(!processedBets[betId], "Already processed");
processedBets[betId] = true;

// Para claims
mapping(uint256 => mapping(bytes32 => bool)) consumedNullifiers;
require(!consumedNullifiers[marketId][nullifier], "Already claimed");
consumedNullifiers[marketId][nullifier] = true;  // ANTES de transferir
```

---

# SECCION 7: ARQUITECTURA TECNICA DETALLADA

## Componentes del Sistema

### 1. Frontend (Next.js 15)

```typescript
// El PXE corre en el BROWSER del usuario
// Esto es crucial para privacidad - keys nunca salen del dispositivo

const pxe = await createPXEService(aztecNode, config);

// Crear wallet
const wallet = await EmbeddedWallet.create(pxe, secretKey);

// Interactuar con contrato
const vault = await BetVaultContract.at(vaultAddress, wallet);
await vault.methods.bet(marketId, outcome, amount, commitment, betId, nonce, from).send();
```

### 2. Contratos Aztec (Noir)

**BetVault** - Apuestas y claims privados
```noir
#[aztec]
contract BetVault {
    #[storage]
    struct Storage {
        user_bets: Map<AztecAddress, PrivateSet<BetNote>>,  // Notas encriptadas
        processed_bets: Map<Field, PublicMutable<bool>>,    // Anti-replay publico
        used_nullifiers: Map<Field, PublicMutable<bool>>,   // Anti-replay claims
        token_address: PublicImmutable<AztecAddress>,       // Config
        wormhole_address: PublicImmutable<AztecAddress>,    // Config
    }

    #[private]
    fn bet(...) { }

    #[private]
    fn authorizeClaim(...) { }

    #[utility]
    unconstrained fn get_user_bets(...) { }  // Solo el owner puede leer
}
```

**BetNote** - Nota privada encriptada
```noir
struct BetNote {
    owner: AztecAddress,
    market_id: Field,
    outcome: u8,
    amount: u128,
    bet_id: Field,
    commitment: Field,
    placed_at: u64,
    header: NoteHeader,  // Para encriptacion
}
```

### 3. Wormhole Integration

**Emitter (Aztec)**
```noir
// Formato del log publico que Wormhole observa
let msg: [Field; 13] = [
    sender.to_field(),        // Emitter address
    sequence as Field,        // Sequence number
    nonce as Field,           // Nonce
    consistency as Field,     // Finality level
    context.timestamp(),      // Timestamp
    payloads[0-7],           // 8 chunks de 31 bytes
];

context.emit_public_log(msg);
```

**Receiver (Arbitrum)**
```solidity
function receiveWormholeMessages(bytes[] memory vaas) external {
    IWormhole.VM memory vm = wormhole.parseAndVerifyVM(vaas[0]);

    // Verificar emitter
    require(registeredSenders[vm.emitterChainId] == vm.emitterAddress);

    // Parsear y procesar
    _processPayload(vm.payload);
}
```

### 4. Contracts Arbitrum (Solidity)

**Treasury** - Custodia USDC
```solidity
contract Treasury {
    IERC20 public immutable usdc;

    function deposit(uint256 marketId, address from, uint256 amount) external onlyPredictionMarket {
        usdc.transferFrom(from, address(this), amount);
    }

    function transferPayout(uint256 marketId, address recipient, uint256 amount) external onlyPredictionMarket {
        usdc.transfer(recipient, amount);
    }
}
```

**PredictionMarketCore** - Logica de mercados
```solidity
contract PredictionMarketCore {
    struct Market {
        address owner;
        string question;
        uint256 totalPool;
        uint256 yesTotal;
        uint256 noTotal;
        bool resolved;
        bool winningOutcome;
        uint256 expiresAt;
    }

    function createMarket(...) external { }
    function processBet(...) external onlyWormholeReceiver { }
    function resolveMarket(...) external onlyMarketOwner { }
    function processClaimAuthorization(...) external onlyWormholeReceiver { }
}
```

---

# SECCION 8: DEPLOYMENT Y ORDEN CRITICO

## Orden de Deployment (MUY IMPORTANTE)

El orden importa porque los contratos dependen unos de otros:

```
1. ARBITRUM: Deploy USDC (o usar existente)
   USDC_ADDRESS = 0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d

2. ARBITRUM: Deploy Treasury (necesita USDC)
   treasury = new Treasury(USDC_ADDRESS)

3. ARBITRUM: Deploy PredictionMarketCore (necesita Treasury)
   core = new PredictionMarketCore(treasury)

4. ARBITRUM: Deploy WormholeReceiver (necesita Core)
   receiver = new WormholeReceiver(core, wormholeCore)

5. ARBITRUM: Configurar ownership chain
   treasury.transferOwnership(core)
   core.transferOwnership(receiver)

6. AZTEC: Deploy Token
   token = Token.deploy(admin)

7. AZTEC: Deploy BetVault (necesita Token y Wormhole)
   vault = BetVault.deploy(token, wormhole, admin)

8. ARBITRUM: Registrar emitter de Aztec
   receiver.setRegisteredSender(56, vault.address)  // 56 = Aztec chain ID
```

### Verificacion Post-Deployment

```bash
# Verificar ownership chain
cast call $TREASURY "owner()" # Debe ser PredictionMarketCore
cast call $CORE "owner()"     # Debe ser WormholeReceiver

# Verificar emitter registrado
cast call $RECEIVER "registeredSenders(uint16)" 56  # Debe ser BetVault address
```

---

# SECCION 9: SEGURIDAD

## Threat Model

### Amenaza 1: Double-Betting
- **Ataque:** Usuario envia misma apuesta multiples veces
- **Mitigacion:** bet_id unico, verificado en 3 niveles
- **Status:** MITIGADO

### Amenaza 2: Double-Claiming
- **Ataque:** Usuario reclama misma ganancia multiples veces
- **Mitigacion:** Nullifier unico, commitment tracking
- **Status:** MITIGADO

### Amenaza 3: Commitment Brute-Force
- **Ataque:** Atacante intenta adivinar secret
- **Mitigacion:** 254-bit Field (2^254 posibilidades)
- **Status:** COMPUTACIONALMENTE IMPOSIBLE

### Amenaza 4: Privacy Leakage
- **Ataque:** Linkear apuesta con claim via analisis on-chain
- **Mitigacion:** Nullifier es one-way hash, sin linkabilidad
- **Status:** MITIGADO

### Amenaza 5: Front-Running
- **Ataque:** Ver apuesta pendiente y ejecutar primero
- **Mitigacion:** Transacciones Aztec son privadas, no hay mempool visible
- **Status:** MITIGADO POR DISENO AZTEC

### Amenaza 6: Fake VAA
- **Ataque:** Crear VAA falso sin apuesta real
- **Mitigacion:** 19 Guardians deben firmar, verificacion on-chain
- **Status:** MITIGADO POR WORMHOLE

---

## Invariantes del Sistema

1. **Cada bet_id solo se procesa una vez**
2. **Cada nullifier solo se consume una vez**
3. **Cada commitment solo se reclama una vez**
4. **Suma de payouts <= total_pool** (garantizado por formula)
5. **Solo notas encriptadas son leibles por owner**
6. **Solo emitters registrados pueden enviar mensajes**

---

# SECCION 10: COMPARACION CON ALTERNATIVAS

## Private Markets vs Polymarket

| Feature | Polymarket | Private Markets |
|---------|------------|-----------------|
| Privacidad | NO - Todo publico | SI - Apuestas encriptadas |
| KYC | Requerido | No requerido |
| Front-running | Vulnerable | Imposible |
| Jurisdiccion | USA bloqueado | Sin restricciones geograficas |
| Liquidez | Alta | En desarrollo |
| Fees | ~2% | Configurable |

## Private Markets vs Augur

| Feature | Augur | Private Markets |
|---------|-------|-----------------|
| Privacidad | NO | SI |
| Chain | Ethereum L1 | Aztec L2 + Arbitrum |
| Gas fees | Alto | Bajo |
| Resolucion | Oracle descentralizado | Owner del mercado |
| Complejidad | Alta | Moderada |

## Private Markets vs Gnosis/Omen

| Feature | Gnosis/Omen | Private Markets |
|---------|-------------|-----------------|
| Privacidad | NO | SI |
| Settlement | On-chain CPAMM | Cross-chain Pari-mutuel |
| Liquidez | LP pools | Colateral del creador |
| Composabilidad | Alta (DeFi) | Limitada (cross-chain) |

---

# SECCION 11: ROADMAP Y FUTURO

## Estado Actual (V3)

- [x] BetVault contract (Aztec)
- [x] PredictionMarketCore (Arbitrum)
- [x] WormholeReceiver (Arbitrum)
- [x] Treasury (Arbitrum)
- [x] Relayer (Go)
- [ ] ClaimAuthorizer separado (en progreso)
- [ ] Frontend completo (en progreso)
- [ ] Testnet deployment (proximo)

## Roadmap

### Q1 2025
- Testnet publico en Aztec Alpha + Arbitrum Sepolia
- Frontend MVP con apuestas y claims
- Integracion con wallets existentes

### Q2 2025
- Audit de seguridad
- Optimizacion de gas
- Sistema de resolucion de disputas

### Q3 2025
- Mainnet beta
- Liquidez inicial
- Marketing y adoption

### Futuro
- Multiples tipos de mercados (binary, categorical, scalar)
- Integracion con oracles (Chainlink, UMA)
- Gobernanza descentralizada
- Mobile app

---

# SECCION 12: CONCLUSIONES

## Por que Private Markets?

1. **Primera solucion real de privacidad** para prediction markets
2. **Sin front-running** gracias a transacciones encriptadas
3. **Cross-chain** combina lo mejor de Aztec y Arbitrum
4. **Trustless** - Sin intermediarios, verificacion on-chain
5. **Resistente a censura** - Datos encriptados no pueden ser bloqueados

## El Futuro de Prediction Markets

Los prediction markets tienen potencial para:
- Agregar informacion colectiva de manera eficiente
- Predecir resultados mejor que expertos
- Crear incentivos para investigacion
- Democratizar acceso a mercados de derivados

**Con privacidad**, pueden alcanzar su potencial sin los problemas de:
- Persecucion regulatoria
- Front-running y MEV
- Exposicion de informacion sensible

## Call to Action

- **Developers:** Contribuir al codigo (MIT license)
- **Usuarios:** Testear en testnet
- **Inversores:** Contactar para seed round
- **Investigadores:** Revisar modelo de seguridad

---

# RECURSOS

## Links

- **Aztec Docs:** https://docs.aztec.network/
- **Wormhole Docs:** https://docs.wormhole.com/
- **Arbitrum Docs:** https://docs.arbitrum.io/
- **Noir Language:** https://noir-lang.org/

## Contacto

- **GitHub:** [repo]
- **Discord:** [invite]
- **Twitter:** [handle]

---

**Fin de la Presentacion**

*Private Markets - Prediction Markets con Privacidad Real*
