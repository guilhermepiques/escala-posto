/**
 * Testes das regras do banco (firestore.rules) no emulador do Firebase.
 * Rodar com: npm run test:rules  (precisa de Java instalado)
 */
import { readFileSync } from 'node:fs';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, query, setDoc, updateDoc, where } from 'firebase/firestore';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';

const DONO = { uid: 'dono', email: 'dono@x.com' };
const GERENTE = { uid: 'gerente', email: 'gerente@x.com' }; // pode editar
const TIO = { uid: 'tio', email: 'tio@x.com' }; // só ver
const ESTRANHO = { uid: 'estranho', email: 'estranho@x.com' };
const ADMIN = { uid: 'admin', email: 'admin@x.com' };
const DONO2 = { uid: 'dono2', email: 'dono2@x.com' };
const ANTIGO = { uid: 'antigo', email: 'antigo@x.com' }; // membro de posto antigo (sem lista de editores)

let env: RulesTestEnvironment;

const as = (u: { uid: string; email: string }, verified = true) =>
  env.authenticatedContext(u.uid, { email: u.email, email_verified: verified }).firestore();

const emp = (by: string, schemaVersion = 1) => ({ id: 'e1', name: 'Ana', schemaVersion, updatedBy: by });

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-escalapp',
    firestore: { rules: readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 },
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'postos/p1'), {
      ownerUid: DONO.uid,
      ownerEmail: DONO.email,
      members: [DONO.email, GERENTE.email, TIO.email],
      editors: [DONO.email, GERENTE.email],
    });
    await setDoc(doc(db, 'postos/p1/meta/config'), { businessName: 'Posto 1', schemaVersion: 1 });
    await setDoc(doc(db, 'postos/p1/employees/e1'), emp(DONO.email));
    // Posto criado por uma versão antiga do app: sem `editors`.
    await setDoc(doc(db, 'postos/p2'), { ownerUid: DONO2.uid, ownerEmail: DONO2.email, members: [DONO2.email, ANTIGO.email] });
    await setDoc(doc(db, 'admins/admin'), {});
  });
});

describe('quem só pode ver', () => {
  it('lê configurações, funcionários e escalas', async () => {
    await assertSucceeds(getDoc(doc(as(TIO), 'postos/p1/meta/config')));
    await assertSucceeds(getDocs(collection(as(TIO), 'postos/p1/employees')));
  });
  it('não grava, não apaga e não mexe no histórico nem na lixeira', async () => {
    await assertFails(setDoc(doc(as(TIO), 'postos/p1/employees/e1'), emp(TIO.email)));
    await assertFails(deleteDoc(doc(as(TIO), 'postos/p1/employees/e1')));
    await assertFails(setDoc(doc(as(TIO), 'postos/p1/schedules/2026-12/history/h1'), { at: 1, schemaVersion: 1, updatedBy: TIO.email }));
    await assertFails(setDoc(doc(as(TIO), 'postos/p1/trash/e1'), { deletedAt: 1, schemaVersion: 1, updatedBy: TIO.email }));
  });
  it('não muda a lista de acesso', async () => {
    await assertFails(updateDoc(doc(as(TIO), 'postos/p1'), { editors: [DONO.email, GERENTE.email, TIO.email] }));
  });
});

describe('quem pode editar', () => {
  it('grava, apaga, guarda histórico e lixeira', async () => {
    await assertSucceeds(setDoc(doc(as(GERENTE), 'postos/p1/employees/e1'), emp(GERENTE.email)));
    await assertSucceeds(setDoc(doc(as(GERENTE), 'postos/p1/schedules/2026-12/history/h1'), { at: 1, schemaVersion: 1, updatedBy: GERENTE.email }));
    await assertSucceeds(setDoc(doc(as(GERENTE), 'postos/p1/trash/e1'), { deletedAt: 1, schemaVersion: 1, updatedBy: GERENTE.email }));
    await assertSucceeds(deleteDoc(doc(as(GERENTE), 'postos/p1/employees/e1')));
  });
  it('não grava em nome de outra pessoa', async () => {
    await assertFails(setDoc(doc(as(GERENTE), 'postos/p1/employees/e1'), emp(DONO.email)));
  });
  it('não muda a lista de acesso (só o dono)', async () => {
    await assertFails(updateDoc(doc(as(GERENTE), 'postos/p1'), { members: [DONO.email, GERENTE.email] }));
    // Regressão: a regra das subcoleções não pode valer para o próprio documento do posto.
    await assertFails(updateDoc(doc(as(GERENTE), 'postos/p1'), { schemaVersion: 1, updatedBy: GERENTE.email, ownerUid: GERENTE.uid }));
    await assertFails(deleteDoc(doc(as(GERENTE), 'postos/p1')));
    await assertFails(updateDoc(doc(as(TIO), 'postos/p1'), { editors: [DONO.email, GERENTE.email, TIO.email], schemaVersion: 1 }));
  });
  it('posto antigo sem lista de editores: todos os membros editam, como antes', async () => {
    await assertSucceeds(setDoc(doc(as(ANTIGO), 'postos/p2/employees/e1'), emp(ANTIGO.email)));
  });
});

describe('dono', () => {
  it('muda quem pode ver e quem pode editar', async () => {
    await assertSucceeds(
      updateDoc(doc(as(DONO), 'postos/p1'), { members: [DONO.email, GERENTE.email, TIO.email], editors: [DONO.email, TIO.email] }),
    );
  });
  it('não tira a si mesmo de quem edita nem da lista', async () => {
    await assertFails(updateDoc(doc(as(DONO), 'postos/p1'), { editors: [GERENTE.email] }));
    await assertFails(updateDoc(doc(as(DONO), 'postos/p1'), { members: [GERENTE.email], editors: [GERENTE.email] }));
  });
  it('não coloca como editor quem não tem acesso', async () => {
    await assertFails(updateDoc(doc(as(DONO), 'postos/p1'), { editors: [DONO.email, ESTRANHO.email] }));
  });
  it('não troca o dono', async () => {
    await assertFails(updateDoc(doc(as(DONO), 'postos/p1'), { ownerEmail: GERENTE.email }));
  });
});

describe('conta nova', () => {
  it('cria o próprio posto', async () => {
    await assertSucceeds(
      setDoc(doc(as(ESTRANHO), `postos/${ESTRANHO.uid}`), {
        ownerUid: ESTRANHO.uid,
        ownerEmail: ESTRANHO.email,
        members: [ESTRANHO.email],
        editors: [ESTRANHO.email],
        createdAt: 1,
      }),
    );
  });
  it('não cria posto com id de outra pessoa nem já com outros e-mails', async () => {
    await assertFails(setDoc(doc(as(ESTRANHO), 'postos/outro'), { ownerUid: ESTRANHO.uid, ownerEmail: ESTRANHO.email, members: [ESTRANHO.email] }));
    await assertFails(
      setDoc(doc(as(ESTRANHO), `postos/${ESTRANHO.uid}`), {
        ownerUid: ESTRANHO.uid,
        ownerEmail: ESTRANHO.email,
        members: [ESTRANHO.email],
        editors: [ESTRANHO.email, DONO.email],
      }),
    );
  });
});

describe('quem não tem acesso', () => {
  it('não lê nada do posto', async () => {
    await assertFails(getDoc(doc(as(ESTRANHO), 'postos/p1')));
    await assertFails(getDoc(doc(as(ESTRANHO), 'postos/p1/meta/config')));
    await assertFails(getDocs(collection(as(ESTRANHO), 'postos')));
  });
  it('e-mail não verificado não entra', async () => {
    await assertFails(getDoc(doc(as(TIO, false), 'postos/p1/meta/config')));
  });
  it('sem login não entra', async () => {
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), 'postos/p1/meta/config')));
  });
});

describe('lista de postos', () => {
  it('cada um lista só os postos em que tem acesso', async () => {
    await assertSucceeds(getDocs(query(collection(as(TIO), 'postos'), where('members', 'array-contains', TIO.email))));
  });
  it('o administrador lista e lê todos, mas não edita', async () => {
    await assertSucceeds(getDocs(collection(as(ADMIN), 'postos')));
    await assertSucceeds(getDoc(doc(as(ADMIN), 'postos/p1/meta/config')));
    await assertFails(setDoc(doc(as(ADMIN), 'postos/p1/employees/e1'), emp(ADMIN.email)));
  });
});

describe('administrador e versão mínima', () => {
  it('cada um só consegue ver o próprio registro de administrador', async () => {
    await assertSucceeds(getDoc(doc(as(ADMIN), 'admins/admin')));
    await assertSucceeds(getDoc(doc(as(TIO), 'admins/tio'))); // não existe, mas pode perguntar
    await assertFails(getDoc(doc(as(TIO), 'admins/admin')));
    await assertFails(setDoc(doc(as(TIO), 'admins/tio'), {}));
  });
  it('só o administrador muda a versão mínima; todos leem', async () => {
    await assertFails(setDoc(doc(as(DONO), 'plataforma/app'), { minSchemaVersion: 0 }));
    await assertFails(setDoc(doc(as(ADMIN), 'plataforma/app'), { minSchemaVersion: 'x' }));
    await assertFails(setDoc(doc(as(ADMIN), 'plataforma/outro'), { minSchemaVersion: 1 }));
    await assertSucceeds(setDoc(doc(as(ADMIN), 'plataforma/app'), { minSchemaVersion: 2 }));
    await assertSucceeds(getDoc(doc(as(TIO), 'plataforma/app')));
  });
  it('sem versão mínima, até app antigo (sem número de versão) grava', async () => {
    await assertSucceeds(setDoc(doc(as(GERENTE), 'postos/p1/employees/e1'), { id: 'e1', name: 'Ana' }));
  });
  it('com versão mínima 2, app de formato 1 ou sem número é recusado', async () => {
    await env.withSecurityRulesDisabled((ctx) => setDoc(doc(ctx.firestore(), 'plataforma/app'), { minSchemaVersion: 2 }));
    await assertFails(setDoc(doc(as(GERENTE), 'postos/p1/employees/e1'), emp(GERENTE.email, 1)));
    await assertFails(setDoc(doc(as(GERENTE), 'postos/p1/employees/e1'), { id: 'e1', name: 'Ana' }));
    await assertSucceeds(setDoc(doc(as(GERENTE), 'postos/p1/employees/e1'), emp(GERENTE.email, 2)));
  });
});
