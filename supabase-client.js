/* SEO Service Provider - Supabase cloud data layer (optional)
 *
 * Activated only when window.SEOPRO_SUPABASE_URL and window.SEOPRO_SUPABASE_ANON_KEY
 * are set in index.html. Until then the app keeps using browser localStorage.
 *
 * Security model:
 *  - Supabase Auth issues the session (JWT).
 *  - Row Level Security (see supabase/schema.sql) lets a user read/write only
 *    their own rows, and lets admins read all. So opening the browser console
 *    cannot read other people's data.
 *  - The anon key is public by design; the secret service-role key stays server-side.
 */
(function () {
  var URL_BASE = (typeof window !== 'undefined' && window.SEOPRO_SUPABASE_URL) ? String(window.SEOPRO_SUPABASE_URL).replace(/\/$/, '') : ''
  var ANON = (typeof window !== 'undefined' && window.SEOPRO_SUPABASE_ANON_KEY) ? String(window.SEOPRO_SUPABASE_ANON_KEY) : ''

  var client = null

  function enabled() { return !!(URL_BASE && ANON) }

  async function init() {
    if (!enabled()) return false
    if (client) return true
    try {
      var mod = await import('https://esm.sh/@supabase/supabase-js@2')
      client = mod.createClient(URL_BASE, ANON, { auth: { persistSession: true, autoRefreshToken: true } })
      return true
    } catch (e) {
      console.warn('Supabase init failed, falling back to local storage:', e && e.message)
      client = null
      return false
    }
  }

  async function sessionEmail() {
    if (!client) return ''
    try {
      var s = await client.auth.getSession()
      return (s && s.data && s.data.session && s.data.session.user && s.data.session.user.email) || ''
    } catch (e) { return '' }
  }

  async function accessToken() {
    if (!client) return ''
    try {
      var s = await client.auth.getSession()
      return (s && s.data && s.data.session && s.data.session.access_token) || ''
    } catch (e) { return '' }
  }

  async function signUp(name, email, password) {
    var r = await client.auth.signUp({ email: email, password: password })
    if (r.error) throw r.error
    var uid = r.data && r.data.user && r.data.user.id
    if (uid) {
      await client.from('profiles').upsert({ id: uid, name: name || '', email: email })
    }
    return r.data
  }

  async function signIn(email, password) {
    var r = await client.auth.signInWithPassword({ email: email, password: password })
    if (r.error) throw r.error
    return r.data
  }

  async function signOut() {
    if (!client) return
    try { await client.auth.signOut() } catch (e) {}
  }

  async function pullAll() {
    var out = { profiles: [], payments: [], reports: [], chats: [] }
    if (!client) return out
    try {
      var me = await sessionEmail()
      var admin = false
      if (me) {
        var p = await client.from('profiles').select('*').eq('email', me).maybeSingle()
        admin = !!(p && p.data && p.data.role === 'admin')
      }
      var profilesQ = client.from('profiles').select('*')
      var res = await profilesQ
      out.profiles = (res.data || []).map(toLocalUser)
      if (admin) {
        var pay = await client.from('payments').select('*')
        var rep = await client.from('reports').select('*')
        var cha = await client.from('chats').select('*')
        out.payments = (pay.data || []).map(toLocalPayment)
        out.reports = (rep.data || []).map(toLocalReport)
        out.chats = (cha.data || []).map(toLocalChat)
      } else if (me) {
        var pay2 = await client.from('payments').select('*').eq('email', me)
        var rep2 = await client.from('reports').select('*').eq('email', me)
        var cha2 = await client.from('chats').select('*').eq('email', me)
        out.payments = (pay2.data || []).map(toLocalPayment)
        out.reports = (rep2.data || []).map(toLocalReport)
        out.chats = (cha2.data || []).map(toLocalChat)
      }
    } catch (e) {
      console.warn('Supabase pull failed:', e && e.message)
    }
    return out
  }

  async function upsert(table, row, opts) {
    if (!client) return
    try { await client.from(table).upsert(row, opts || {}) } catch (e) { console.warn('Supabase upsert failed:', e && e.message) }
  }

  async function remove(table, match) {
    if (!client) return
    try { await client.from(table).delete().match(match) } catch (e) {}
  }

  // ---- shape converters ----
  function toLocalUser(p) {
    return {
      uid: p.id, name: p.name, email: p.email, provider: 'supabase', role: p.role,
      blocked: !!p.blocked, deleted: !!p.deleted, deletedAt: p.deleted_at,
      phone: p.phone, phoneVerified: !!p.phone_verified,
      premium: p.plan ? { status: 'Active', plan: p.plan, planName: p.plan_name, agents: p.plan_agents, daily: p.plan_daily, monthly: p.plan_monthly, since: p.premium_since } : null,
      createdAt: p.created_at
    }
  }
  function toLocalPayment(p) {
    return { id: p.client_ref || p.id, email: p.email, name: p.name, plan: p.plan, planName: p.plan_name, amount: Number(p.amount), method: p.method, methodId: p.method_id, trx: p.trx, status: p.status, autoApproved: !!p.auto_approved, verifiedAt: p.verified_at, createdAt: p.created_at }
  }
  function toLocalReport(r) {
    return { id: r.client_ref || r.id, email: r.email, primary: r.primary_keyword, titleCount: r.title_count, intent: r.intent, titles: r.titles || [], date: r.created_at }
  }
  function toLocalChat(c) {
    return { id: c.client_ref || c.id, email: c.email, name: c.name, messages: c.messages || [], userUnread: c.user_unread, adminUnread: c.admin_unread, updatedAt: c.updated_at }
  }

  window.SeoCloud = { enabled: enabled, init: init, sessionEmail: sessionEmail, accessToken: accessToken, signUp: signUp, signIn: signIn, signOut: signOut, pullAll: pullAll, upsert: upsert, remove: remove }
})();
