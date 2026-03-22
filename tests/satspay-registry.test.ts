import { describe, expect, it, beforeEach } from "vitest";
import { Cl } from "@stacks/transactions";

const accounts = simnet.getAccounts();
const deployer = accounts.get("deployer")!;
const wallet1 = accounts.get("wallet_1")!;
const wallet2 = accounts.get("wallet_2")!;
const wallet3 = accounts.get("wallet_3")!;

// Create a buffer hash for testing (32 bytes)
const phoneHash1 = Cl.buffer(new Uint8Array(32).fill(1));
const phoneHash2 = Cl.buffer(new Uint8Array(32).fill(2));
const invalidHash = Cl.buffer(new Uint8Array(31).fill(1)); // 31 bytes

describe("satspay-registry", () => {
  it("register-success", () => {
    const { result, events } = simnet.callPublicFn("satspay-registry", "register", [phoneHash1], wallet1);
    expect(result).toBeOk(Cl.bool(true));
    expect(events.length).toBe(1);
    expect(events[0].event).toBe("printEvent");
    // Emits { event: "phone-registered", phone-hash: phone-hash, owner: tx-sender, registered-at: burn-block-height }
  });

  it("register-invalid-hash", () => {
    const { result } = simnet.callPublicFn("satspay-registry", "register", [invalidHash], wallet1);
    expect(result).toBeErr(Cl.uint(102)); // err-invalid-hash
  });

  it("register-duplicate-phone", () => {
    // First registration
    simnet.callPublicFn("satspay-registry", "register", [phoneHash1], wallet1);

    // Second registration of same phone hash from another wallet should fail (u100)
    const { result } = simnet.callPublicFn("satspay-registry", "register", [phoneHash1], wallet2);
    expect(result).toBeErr(Cl.uint(100)); // err-already-registered
  });

  it("register-duplicate-address", () => {
    // First registration
    simnet.callPublicFn("satspay-registry", "register", [phoneHash1], wallet1);

    // Second registration from same wallet with different phone hash should fail (u101)
    const { result } = simnet.callPublicFn("satspay-registry", "register", [phoneHash2], wallet1);
    expect(result).toBeErr(Cl.uint(101)); // err-address-has-phone
  });

  it("deregister-success", () => {
    simnet.callPublicFn("satspay-registry", "register", [phoneHash1], wallet1);
    
    const { result, events } = simnet.callPublicFn("satspay-registry", "deregister", [], wallet1);
    expect(result).toBeOk(Cl.bool(true));
    expect(events.length).toBe(1);
    
    // Verify it's actually removed
    const getAddress = simnet.callReadOnlyFn("satspay-registry", "get-address-for-phone", [phoneHash1], deployer);
    expect(getAddress.result).toBeNone();
    
    const getPhone = simnet.callReadOnlyFn("satspay-registry", "get-phone-for-address", [Cl.principal(wallet1)], deployer);
    expect(getPhone.result).toBeNone();
  });

  it("deregister-not-registered", () => {
    const { result } = simnet.callPublicFn("satspay-registry", "deregister", [], wallet1);
    expect(result).toBeErr(Cl.uint(200)); // err-not-registered
  });

  it("update-address-success", () => {
    simnet.callPublicFn("satspay-registry", "register", [phoneHash1], wallet1);
    
    const { result, events } = simnet.callPublicFn("satspay-registry", "update-address", [phoneHash1, Cl.principal(wallet2)], wallet1);
    expect(result).toBeOk(Cl.bool(true));
    expect(events.length).toBe(1);

    // Verify mappings updated
    const getAddress = simnet.callReadOnlyFn("satspay-registry", "get-address-for-phone", [phoneHash1], deployer);
    expect(getAddress.result).toBeSome(Cl.tuple({ 
      owner: Cl.principal(wallet2), 
      "registered-at": Cl.uint(simnet.blockHeight),
      active: Cl.bool(true) 
    }));
  });

  it("update-address-wrong-owner", () => {
    simnet.callPublicFn("satspay-registry", "register", [phoneHash1], wallet1);
    
    // Wallet 2 tries to update Wallet 1's phone registration
    const { result } = simnet.callPublicFn("satspay-registry", "update-address", [phoneHash1, Cl.principal(wallet3)], wallet2);
    expect(result).toBeErr(Cl.uint(301)); // err-not-owner
  });

  it("get-address-for-phone-found", () => {
    simnet.callPublicFn("satspay-registry", "register", [phoneHash1], wallet1);
    
    const { result } = simnet.callReadOnlyFn("satspay-registry", "get-address-for-phone", [phoneHash1], deployer);
    expect(result).toBeSome(Cl.tuple({
      owner: Cl.principal(wallet1),
      "registered-at": Cl.uint(simnet.blockHeight),
      active: Cl.bool(true)
    }));
  });

  it("get-address-for-phone-not-found", () => {
    const { result } = simnet.callReadOnlyFn("satspay-registry", "get-address-for-phone", [phoneHash1], deployer);
    expect(result).toBeNone();
  });

  it("is-registered-true", () => {
    simnet.callPublicFn("satspay-registry", "register", [phoneHash1], wallet1);
    
    const { result } = simnet.callReadOnlyFn("satspay-registry", "is-registered", [phoneHash1], deployer);
    expect(result).toBeBool(true);
  });

  it("is-registered-false", () => {
    const { result } = simnet.callReadOnlyFn("satspay-registry", "is-registered", [phoneHash1], deployer);
    expect(result).toBeBool(false);
  });
});
