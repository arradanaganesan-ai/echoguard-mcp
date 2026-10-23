# EchoGuard MCP — Emergency Safety Architecture & Policy Guidelines

> **CRITICAL LIFE SAFETY DIRECTIVE:**  
> Natural gas leaks present an acute risk of flammable vapor cloud deflagration, explosive detonation, and toxic asphyxiation. Under no circumstances may an automated AI system delay life-safety evacuation or operate electrical components in a suspected fuel-gas atmosphere.

---

## 1. Why AI Reasoning Cannot Be Trusted With Emergency Life-Safety

Large Language Models (LLMs) and probabilistic AI agents exhibit well-documented safety vulnerabilities when given emergency authority:
1. **Plausible but Fatal Suggestions:** When a user reports *"I smell gas in the basement"*, a standard language model frequently suggests intuitive but catastrophic actions such as *"Turn on the basement exhaust fan to ventilate the fumes"* or *"Switch on the floodlights so you can inspect the pipe"*.
2. **The Physics of Ignition:** Flipping a standard residential toggle switch or starting a ventilation fan creates micro-arcs across internal electrical contacts. In an ambient fuel-air mixture between the Lower Explosive Limit (LEL ~5% for methane) and Upper Explosive Limit (UEL ~15%), **a single electrical spark triggers an instantaneous catastrophic explosion**.
3. **Hallucinated Sensor Telemetry:** Unconstrained agents often invent sensor readings (e.g. *"Sensor reports 12 ppm — moderate safety level"*), causing residents to linger in lethal environments.
4. **Jailbreak Susceptibility:** LLMs can be persuaded or manipulated by adversarial prompt engineering to bypass safety guardrails.

**EchoGuard MCP enforces an architectural separation:** Generative agent reasoning is strictly bounded by a **deterministic, hard-coded safety gate implemented in compiled code** that no prompt, user directive, or agent output can override.

---

## 2. Hard-Coded Safety Rules Reference

| Rule ID | Severity | Name | Enforcement Summary |
|---------|----------|------|---------------------|
| `RULE-GAS-EVAC` | **MANDATORY** | Immediate Evacuation Priority | Mandates that all occupants evacuate immediately on foot to an assembly point at least 300 feet (100m) upwind. Forbids delaying evacuation for sensor confirmation. |
| `RULE-SPARK-BLOCK` | **BLOCKING** | Spark & Electrical Prohibition | Strictly blocks turning ON or OFF light switches, exhaust fans, range hoods, HVAC units, electrical appliances, or circuit breakers in the affected area. |
| `RULE-ACTUATOR-BLOCK` | **BLOCKING** | Physical Actuator Isolation Barrier | Strictly forbids direct physical actuation commands on gas solenoid shutoff valves, motorized door deadbolts, or ventilation flaps. All actuations are simulation-only. |
| `RULE-NO-AUTODIAL` | **BLOCKING** | Controlled Communication & Verification | Forbids automated, unattended 911 dispatch calls or broad emergency notifications without explicit human operator confirmation. |
| `RULE-NO-DIAGNOSIS` | **ADVISORY** | Medical Diagnosis Prohibition | Forbids diagnosing medical conditions (e.g. ocular chemical burns vs conjunctivitis). Directs occupant to fresh air and medical evaluation. |

---

## 3. Strict Prohibitions During Suspected Gas Leaks

The following actions are hard-coded into the Safety Policy Agent as immediate blocks:

1. **NO Exhaust Fans or Range Hoods:** Fan motor switches and brushes generate spark arcs.
2. **NO Light Switches or Lamps:** Do not flip toggle switches ON or OFF. (If a light is on, leave it on; if off, leave it off).
3. **NO Circuit Breakers:** Flipping breaker panels generates significant electrical arcing.
4. **NO Telephones Inside Structure:** Do not use landlines or cellphones inside the leak area. Only use mobile phones once safely 300 feet upwind.
5. **NO Appliance Cycling:** Do not turn on stoves, ovens, microwaves, or refrigerators.
6. **NO Motorized Actuators:** Do not attempt automated valve closure using non-intrinsically-safe DIY actuators.

---

## 4. Test Proof: Safety Gate Unit Verification

EchoGuard's test suite includes automated checks (`tests/safety-policy.test.ts` and `tests/mcp-tools.test.ts`) that programmatically verify:
- Turning on an exhaust fan returns `allowed: false` with rule `RULE-SPARK-BLOCK`.
- Operating light switches returns `allowed: false` with rule `RULE-SPARK-BLOCK`.
- Motorized gas solenoid triggers return `allowed: false` with rule `RULE-ACTUATOR-BLOCK`.
- Attempted prompt overrides are ignored by the deterministic TypeScript AST evaluator.

---

## 5. Prototype Disclosures & Non-Certified Limitations

- **Prototype Status:** EchoGuard MCP is an engineering research prototype developed for hackathon demonstration. It is **NOT** a certified life-safety device under UL 1484, NFPA 54, or EN 50194.
- **Simulation-Only Actuation:** Physical smart-home actuation is strictly simulated. No live circuits are energized.
- **Non-Autonomous Emergency Dispatch:** All notifications generated are drafts and require verified human operator authorization before transmission.
