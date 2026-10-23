# EchoGuard MCP — 3-Minute Judge Demonstration Script

> **Goal:** Showcase the differentiator: An MCP-based, safety-governed emergency coordination layer that prevents catastrophic AI mistakes, enforces hard-coded safety gates, and synthesizes responder-ready briefings.

---

## Act 1: The Problem & Innovation Hypothesis (0:00 – 0:30)

1. **Open Dashboard:** Navigate to [http://localhost:3001](http://localhost:3001) in your browser.
2. **Hook:**
   > *"Judges, imagine a resident panic-speaking to an AI assistant: 'I smell gas and my eyes are burning in the kitchen.' A standard LLM will often innocently say: 'Turn on the exhaust fan to vent the fumes and check the stove.' That single sentence can detonate the house.*
   > 
   > *Flipping a light switch or starting a fan creates internal electrical micro-sparks. In a gas-air mixture, sparks trigger catastrophic explosions.*
   > 
   > *EchoGuard MCP solves this: we separate generative reasoning from an immutable, hard-coded safety gate exposed through the official Model Context Protocol."*

---

## Act 2: Running Scenario A — Gas Leak & Evacuation First (0:30 – 1:15)

1. Click on the **Live Console** tab.
2. Click **Scenario A: Suspected Gas Leak & Eye Irritation** in the top strip.
3. Observe the populated report: *"I smell gas and my eyes are burning in the kitchen."*
4. Click **Run Emergency Multi-Agent Simulation**.
5. **Point out the Immediate Results:**
   - **Urgent Red Evacuation Banner:** `RULE-GAS-EVAC ENFORCED` appears instantly at the top: *"LEAVE THE BUILDING IMMEDIATELY on foot. Move to 300ft upwind assembly zone."*
   - **Classification:** `CRITICAL` Severity Score: 95/100.
   - **Data Provenance:** Point to the sensor line: *"UNVERIFIED (Human Senses Only)"*. Notice EchoGuard refuses to hallucinate fake PPM numbers.
   - **Multi-Agent Timeline:** Show the chronological steps: Intake $\to$ Risk $\to$ Coordination $\to$ Safety Policy $\to$ Briefing.

---

## Act 3: Testing Scenario D — The Spark Hazard Interception (1:15 – 2:00)

1. Under the **Safety Policy Engine & Hard-Coded Rules** box on the Live Console:
   - Click the interactive test button: **"Try: Turn On Exhaust Fan (Spark Test)"**.
2. **Watch the Safety Policy Intervene:**
   - A bold red violation card appears instantly!
   - Violated Rule: **`RULE-SPARK-BLOCK`**
   - Reason: *"CRITICAL SAFETY BLOCK: Operating 'turn_on_exhaust_fan' on 'Kitchen Vent Fan' is forbidden during a suspected gas leak. Flipping switches produces internal electrical arcs that can ignite flammable gas mixtures."*
   - Harm Prevented: *"Catastrophic vapor cloud explosion / domestic structure detonation."*
3. Click the next button: **"Try: Trigger Solenoid Valve (Actuator Test)"**.
   - Blocked under **`RULE-ACTUATOR-BLOCK`** (Physical actuator isolation barrier).
4. Explain to the judges:
   > *"No LLM prompt injection, rogue agent command, or user panic can bypass this check. The safety rule is compiled code."*

---

## Act 4: Official MCP Tool Execution (2:00 – 2:30)

1. Click the **MCP Tools** tab in the top navigation bar.
2. Point out:
   - Status: **`MCP: Stdio Online`** running on the official `@modelcontextprotocol/sdk`.
   - All 7 registered tools: `create_incident`, `assess_incident`, `get_safety_guidance`, `prepare_notification`, `generate_incident_briefing`, `get_incident_timeline`, `simulate_action`.
3. Select **`simulate_action`**, leave the parameter as `turn_on_exhaust_fan`, and click **Execute Tool Call**.
4. Show the real JSON output returned over MCP:
   ```json
   {
     "status": "BLOCKED",
     "allowed": false,
     "violatedRuleId": "RULE-SPARK-BLOCK",
     "reason": "CRITICAL SAFETY BLOCK: Operating 'turn_on_exhaust_fan' is forbidden..."
   }
   ```
5. Click the **Client Config** sub-tab: show the standard `claude_desktop_config.json` snippet ready for any external MCP client.

---

## Act 5: Responder-Ready Briefing & Human Verification (2:30 – 3:00)

1. Click the **Briefing & Dispatch** tab.
2. Show the structured briefing:
   - **Audit Verification Hash:** (e.g. `EG-6533B099-MVHWOKLG`).
   - Executive Summary.
   - Verified Known Facts vs. Unverified Information.
   - Action Tally: Screened, Simulated Safe, and Blocked.
3. Show the **Notification Previews**:
   - Draft for Metro Fire & 911 Communications.
   - Notice the status: *"SIMULATED DISPATCH PREVIEW: Requires verified human transmission."*
   - Click **Authorize Draft (Simulate Send)** to demonstrate the Human-In-The-Loop gate.
4. Click **Download .MD** or **Copy Briefing** to demonstrate the responder handoff file.
5. **Concluding Wrap-Up:**
   > *"EchoGuard MCP transforms AI emergency handling from an unguided liability into a safety-governed, auditable, and responder-ready coordination layer. Tested, runnable, zero API keys required, and available right now. Thank you."*
