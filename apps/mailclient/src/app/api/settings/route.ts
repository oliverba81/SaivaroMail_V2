import { NextRequest, NextResponse } from 'next/server';
import { extractTokenFromHeader, verifyToken } from '@/lib/auth';
import { getTenantDbClient, getTenantDbClientBySlug } from '@/lib/tenant-db-client';
import { getCompanyConfig, saveCompanyConfig, validateOpenAIApiKey, validateElevenLabsApiKey } from '@/lib/company-config';

/**
 * GET /api/settings
 * Lädt Benutzereinstellungen
 */
export async function GET(request: NextRequest) {
  try {
    // Tenant-Context aus Request extrahieren
    let companyId: string | null = null;
    let companySlug: string | null = null;
    
    const hostname = request.headers.get('host') || '';
    const subdomain = hostname.split('.')[0];
    
    if (subdomain && subdomain !== 'localhost' && subdomain !== 'www') {
      companySlug = subdomain;
    }
    
    const headerCompanyId = request.headers.get('x-company-id');
    const headerCompanySlug = request.headers.get('x-company-slug');
    
    if (headerCompanyId) {
      companyId = headerCompanyId;
    } else if (headerCompanySlug) {
      companySlug = headerCompanySlug;
    }
    
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authorization-Token erforderlich' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    
    if (!payload) {
      return NextResponse.json(
        { error: 'Ungültiger Token' },
        { status: 401 }
      );
    }
    
    if (!companyId && payload.companyId) {
      companyId = payload.companyId;
    }
    
    if (!companyId && !companySlug) {
      return NextResponse.json(
        { error: 'Tenant-Context nicht gesetzt' },
        { status: 400 }
      );
    }

    // Tenant-DB-Client holen (getTenantDbClientBySlug nutzt Cache, vermeidet doppelten SCC-Call)
    let client;
    if (companyId) {
      client = await getTenantDbClient(companyId);
    } else if (companySlug) {
      client = await getTenantDbClientBySlug(companySlug);
    } else {
      return NextResponse.json(
        { error: 'Company-ID oder Slug erforderlich' },
        { status: 400 }
      );
    }

    try {
      // Lade Company-Config (Fallback bei Schema-Problemen)
      let companyConfig;
      try {
        companyConfig = await getCompanyConfig(client);
      } catch (configErr: any) {
        console.error('getCompanyConfig fehlgeschlagen, verwende Standard-Config:', configErr?.message);
        companyConfig = {
          openaiApiKey: null,
          openaiModel: 'gpt-4o-mini',
          elevenlabsApiKey: null,
          elevenlabsVoiceId: null,
          elevenlabsEnabled: false,
          themeRequired: false,
          permanentDeleteAfterDays: 0,
        };
      }
      
      // Company-Filter und Benutzer-Filter-Sichtbarkeit laden
      let companyEmailFilters: any[] = [];
      try {
        const companyConfigRow = await client.query(
          `SELECT email_filters FROM company_config WHERE id = 'company_config'`
        );
        if (companyConfigRow.rows[0]?.email_filters != null) {
          const raw = companyConfigRow.rows[0].email_filters;
          companyEmailFilters = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : []);
        }
      } catch {
        // Spalte email_filters existiert ggf. noch nicht
      }

      // Einmalige Sync: Wenn Company-Filter leer, aus user_settings des aktuellen Users übernehmen (Migration)
      if (companyEmailFilters.length === 0) {
        const userSettingsRow = await client.query(
          `SELECT email_filters FROM user_settings WHERE user_id = $1`,
          [payload.sub]
        );
        if (userSettingsRow.rows[0]?.email_filters != null) {
          const raw = userSettingsRow.rows[0].email_filters;
          const userFilters = Array.isArray(raw) ? raw : (typeof raw === 'string' ? JSON.parse(raw) : []);
          if (userFilters.length > 0) {
            try {
              await client.query(
                `UPDATE company_config SET email_filters = $1::jsonb, updated_at = NOW() WHERE id = 'company_config'`,
                [JSON.stringify(userFilters)]
              );
              companyEmailFilters = userFilters;
            } catch {
              // Spalte ggf. noch nicht vorhanden
            }
          }
        }
      }

      let userRole: string;
      let visibleFilterIds: string[] | null = null;
      try {
        const userRow = await client.query(
          `SELECT role, visible_filter_ids FROM users WHERE id = $1`,
          [payload.sub]
        );
        userRole = userRow.rows[0]?.role || 'user';
        if (userRow.rows[0]?.visible_filter_ids != null) {
          const raw = userRow.rows[0].visible_filter_ids;
          visibleFilterIds = Array.isArray(raw) ? raw.map((id: any) => String(id)) : [];
        }
      } catch (userQueryErr: any) {
        if (userQueryErr?.message?.includes('visible_filter_ids')) {
          const fallbackRow = await client.query(`SELECT role FROM users WHERE id = $1`, [payload.sub]);
          userRole = fallbackRow.rows[0]?.role || 'user';
        } else {
          throw userQueryErr;
        }
      }
      
      // Lade Benutzereinstellungen
      const result = await client.query(
        `SELECT fetch_interval_minutes, email_filters, table_columns, search_fields, default_department_id, layout_preferences
         FROM user_settings
         WHERE user_id = $1`,
        [payload.sub]
      );

      // Standard-Spalten definieren
      const defaultTableColumns = [
        { id: 'checkbox', label: '', visible: true, order: 0, width: '40px' },
        { id: 'important', label: 'Wichtig', visible: true, order: 1, width: '60px' },
        { id: 'spam', label: 'Spam', visible: true, order: 2, width: '60px' },
        { id: 'deleted', label: 'Gelöscht', visible: true, order: 3, width: '60px' },
        { id: 'subject', label: 'Betreff', visible: true, order: 4 },
        { id: 'participants', label: 'Beteiligte', visible: true, order: 5 },
        { id: 'date', label: 'Datum', visible: true, order: 6, width: '140px' },
        { id: 'from_cb', label: 'Von (CB)', visible: true, order: 7 },
        { id: 'recipient', label: 'Empfänger...', visible: true, order: 8 },
        { id: 'theme', label: 'Thema', visible: true, order: 9, width: '120px' },
        { id: 'department', label: 'Abteilung', visible: true, order: 10, width: '150px' },
      ];

      const defaultSearchFields = ['subject', 'from', 'body'];

      if (result.rows.length === 0) {
        // Erstelle Standard-Einstellungen
        await client.query(
          `INSERT INTO user_settings (user_id, fetch_interval_minutes, email_filters, table_columns, search_fields, default_department_id)
           VALUES ($1, $2, '[]'::jsonb, $3::jsonb, $4::jsonb, NULL)`,
          [payload.sub, 5, JSON.stringify(defaultTableColumns), JSON.stringify(defaultSearchFields)]
        );
        // Für Sidebar: null = alle anzeigen; [] = keine; sonst nur die angegebenen IDs
        const sidebarFilters = companyEmailFilters.length === 0 ? [] : (
          visibleFilterIds === null ? companyEmailFilters : (
            visibleFilterIds.length === 0 ? [] : companyEmailFilters.filter((f: any) => f.id && visibleFilterIds!.includes(String(f.id)))
          )
        );
        const responsePayload: any = {
          fetchIntervalMinutes: 5,
          emailFilters: sidebarFilters,
          tableColumns: defaultTableColumns,
          searchFields: defaultSearchFields,
          defaultDepartmentId: null,
          layoutPreferences: {},
          openaiApiKey: companyConfig.openaiApiKey || null,
          openaiModel: companyConfig.openaiModel,
          elevenlabsApiKey: companyConfig.elevenlabsApiKey || null,
          elevenlabsVoiceId: companyConfig.elevenlabsVoiceId || null,
          elevenlabsEnabled: companyConfig.elevenlabsEnabled ?? false,
          themeRequired: companyConfig.themeRequired ?? false,
          permanentDeleteAfterDays: companyConfig.permanentDeleteAfterDays ?? 0,
        };
        if (userRole === 'admin') {
          responsePayload.companyEmailFilters = companyEmailFilters;
        }
        const response = NextResponse.json({ settings: responsePayload });
        return response;
      }

      let tableColumns = defaultTableColumns;
      if (result.rows[0].table_columns) {
        try {
          const loadedColumns = Array.isArray(result.rows[0].table_columns) 
            ? result.rows[0].table_columns 
            : JSON.parse(result.rows[0].table_columns);
          
          // Entferne die alte redundante Spalte 'participants_detailed'
          tableColumns = loadedColumns.filter((col: any) => col.id !== 'participants_detailed');
          
          // Füge die Spalte "Abteilung" hinzu, falls sie fehlt
          const hasDepartmentColumn = tableColumns.some((col: any) => col.id === 'department');
          if (!hasDepartmentColumn) {
            tableColumns.push({ id: 'department', label: 'Abteilung', visible: true, order: 10, width: '150px' });
            // Sortiere nach order
            tableColumns.sort((a: any, b: any) => a.order - b.order);
          }
          
          // Falls keine Spalten mehr vorhanden sind, verwende Standard-Spalten
          if (tableColumns.length === 0) {
            tableColumns = defaultTableColumns;
          }
        } catch {
          tableColumns = defaultTableColumns;
        }
      }

      let searchFields = defaultSearchFields;
      if (result.rows[0].search_fields) {
        try {
          const loadedFields = Array.isArray(result.rows[0].search_fields) 
            ? result.rows[0].search_fields 
            : JSON.parse(result.rows[0].search_fields);
          if (Array.isArray(loadedFields) && loadedFields.length > 0) {
            searchFields = loadedFields;
          }
        } catch {
          searchFields = defaultSearchFields;
        }
      }

      let layoutPreferences: Record<string, unknown> = {};
      if (result.rows[0].layout_preferences != null) {
        try {
          layoutPreferences = typeof result.rows[0].layout_preferences === 'object'
            ? (result.rows[0].layout_preferences as Record<string, unknown>)
            : (JSON.parse(result.rows[0].layout_preferences as string) as Record<string, unknown>);
        } catch {
          layoutPreferences = {};
        }
      }

      // Sidebar-Filter: Company-Filter nach visible_filter_ids
      // Admins sehen immer alle Filter. Normale Benutzer nur die explizit zugewiesenen.
      const userSettingsFilters = result.rows[0].email_filters != null
        ? (Array.isArray(result.rows[0].email_filters) ? result.rows[0].email_filters : [])
        : [];
      const companyFiltersForUser = companyEmailFilters.length > 0 ? companyEmailFilters : userSettingsFilters;
      let emailFiltersForResponse: any[];
      if (userRole === 'admin') {
        emailFiltersForResponse = companyFiltersForUser;
      } else if (visibleFilterIds === null || visibleFilterIds.length === 0) {
        emailFiltersForResponse = [];
      } else {
        emailFiltersForResponse = companyFiltersForUser.filter((f: any) => f.id && visibleFilterIds!.includes(String(f.id)));
      }
      const settingsPayload: any = {
        fetchIntervalMinutes: result.rows[0].fetch_interval_minutes || 5,
        emailFilters: emailFiltersForResponse,
        tableColumns: tableColumns,
        searchFields: searchFields,
        defaultDepartmentId: result.rows[0].default_department_id || null,
        layoutPreferences,
        openaiApiKey: companyConfig.openaiApiKey || null,
        openaiModel: companyConfig.openaiModel,
        elevenlabsApiKey: companyConfig.elevenlabsApiKey || null,
        elevenlabsVoiceId: companyConfig.elevenlabsVoiceId || null,
        elevenlabsEnabled: companyConfig.elevenlabsEnabled ?? false,
        themeRequired: companyConfig.themeRequired ?? false,
        permanentDeleteAfterDays: companyConfig.permanentDeleteAfterDays ?? 0,
      };
      if (userRole === 'admin') {
        settingsPayload.companyEmailFilters = companyEmailFilters.length > 0 ? companyEmailFilters : userSettingsFilters;
      }
      return NextResponse.json({
        settings: settingsPayload,
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Fehler beim Laden der Einstellungen:', error);
    const message = process.env.NODE_ENV === 'development' && error?.message
      ? error.message
      : 'Interner Serverfehler';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/settings
 * Aktualisiert Benutzereinstellungen
 */
export async function PATCH(request: NextRequest) {
  try {
    // Tenant-Context aus Request extrahieren
    let companyId: string | null = null;
    let companySlug: string | null = null;
    
    const hostname = request.headers.get('host') || '';
    const subdomain = hostname.split('.')[0];
    
    if (subdomain && subdomain !== 'localhost' && subdomain !== 'www') {
      companySlug = subdomain;
    }
    
    const headerCompanyId = request.headers.get('x-company-id');
    const headerCompanySlug = request.headers.get('x-company-slug');
    
    if (headerCompanyId) {
      companyId = headerCompanyId;
    } else if (headerCompanySlug) {
      companySlug = headerCompanySlug;
    }
    
    const authHeader = request.headers.get('authorization');
    const token = extractTokenFromHeader(authHeader);
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authorization-Token erforderlich' },
        { status: 401 }
      );
    }

    const payload = verifyToken(token);
    
    if (!payload) {
      return NextResponse.json(
        { error: 'Ungültiger Token' },
        { status: 401 }
      );
    }
    
    if (!companyId && payload.companyId) {
      companyId = payload.companyId;
    }
    
    if (!companyId && !companySlug) {
      return NextResponse.json(
        { error: 'Tenant-Context nicht gesetzt' },
        { status: 400 }
      );
    }

    const body = await request.json();
    let { 
      fetchIntervalMinutes, 
      emailFilters, 
      tableColumns, 
      searchFields, 
      defaultDepartmentId,
      layoutPreferences: layoutPreferencesPayload,
      openaiApiKey,
      openaiModel,
      elevenlabsApiKey,
      elevenlabsVoiceId,
      elevenlabsEnabled,
      themeRequired,
      permanentDeleteAfterDays,
    } = body;

    // Entferne die alte redundante Spalte 'participants_detailed' aus tableColumns
    if (tableColumns && Array.isArray(tableColumns)) {
      tableColumns = tableColumns.filter((col: any) => col.id !== 'participants_detailed');
    }

    if (fetchIntervalMinutes !== undefined && (fetchIntervalMinutes < 1 || fetchIntervalMinutes > 1440)) {
      return NextResponse.json(
        { error: 'Abruf-Intervall muss zwischen 1 und 1440 Minuten liegen' },
        { status: 400 }
      );
    }

    // Tenant-DB-Client holen (getTenantDbClientBySlug nutzt Cache, vermeidet doppelten SCC-Call)
    let client;
    let resolvedCompanyId: string;
    if (companyId) {
      client = await getTenantDbClient(companyId);
      resolvedCompanyId = companyId;
    } else if (companySlug) {
      client = await getTenantDbClientBySlug(companySlug);
      const { getCompanyIdBySlug } = await import('@/lib/scc-client');
      const id = await getCompanyIdBySlug(companySlug);
      if (!id) {
        return NextResponse.json(
          { error: 'Company-ID konnte nicht aufgelöst werden' },
          { status: 400 }
        );
      }
      resolvedCompanyId = id;
    } else {
      return NextResponse.json(
        { error: 'Company-ID oder Slug erforderlich' },
        { status: 400 }
      );
    }

    try {
      // Validierung: OpenAI API-Key (falls angegeben)
      if (openaiApiKey !== undefined) {
        const validation = validateOpenAIApiKey(openaiApiKey);
        if (!validation.valid) {
          return NextResponse.json(
            { error: validation.error },
            { status: 400 }
          );
        }
      }
      
      // Validierung: ElevenLabs API-Key (falls angegeben)
      if (elevenlabsApiKey !== undefined) {
        const validation = validateElevenLabsApiKey(elevenlabsApiKey);
        if (!validation.valid) {
          return NextResponse.json(
            { error: validation.error },
            { status: 400 }
          );
        }
      }
      
      // Speichere Company-Config (immer, auch wenn nur andere Einstellungen geändert wurden)
      // Das stellt sicher, dass die Config immer aktualisiert wird
      const configToSave: any = {
        ...(openaiApiKey !== undefined && { openaiApiKey: openaiApiKey || null }),
        ...(openaiModel !== undefined && { openaiModel: openaiModel }),
        ...(elevenlabsApiKey !== undefined && { elevenlabsApiKey: elevenlabsApiKey || null }),
        ...(elevenlabsVoiceId !== undefined && { elevenlabsVoiceId: elevenlabsVoiceId || null }),
      };
      
      // elevenlabsEnabled explizit behandeln, da false ein gültiger Wert ist
      if (elevenlabsEnabled !== undefined) {
        configToSave.elevenlabsEnabled = Boolean(elevenlabsEnabled);
      }
      
      // themeRequired explizit behandeln, da false ein gültiger Wert ist
      if (themeRequired !== undefined) {
        configToSave.themeRequired = Boolean(themeRequired);
      }

      if (permanentDeleteAfterDays !== undefined) {
        const days = Math.max(0, Math.floor(Number(permanentDeleteAfterDays)) || 0);
        if (days < 0 || days > 36500) {
          return NextResponse.json(
            { error: 'Endgültiges Löschen: Tage muss zwischen 0 (nie) und 36500 liegen' },
            { status: 400 }
          );
        }
        configToSave.permanentDeleteAfterDays = days;
      }
      
      await saveCompanyConfig(client, configToSave);
      
      // Validierung: defaultDepartmentId prüfen (falls angegeben)
      if (defaultDepartmentId !== undefined && defaultDepartmentId !== null) {
        // Prüfe, ob Abteilung existiert
        const departmentCheck = await client.query(
          `SELECT d.id, d.is_active, d.company_id
           FROM departments d
           WHERE d.id = $1 AND d.company_id = $2`,
          [defaultDepartmentId, resolvedCompanyId]
        );

        if (departmentCheck.rows.length === 0) {
          return NextResponse.json(
            { error: 'Abteilung nicht gefunden' },
            { status: 404 }
          );
        }

        const department = departmentCheck.rows[0];

        // Prüfe, ob User berechtigt ist (User muss der Abteilung zugewiesen sein ODER Admin sein)
        const userResult = await client.query(
          'SELECT role FROM users WHERE id = $1',
          [payload.sub]
        );

        if (userResult.rows.length === 0) {
          return NextResponse.json(
            { error: 'User nicht gefunden' },
            { status: 404 }
          );
        }

        const userRole = userResult.rows[0].role;

        if (userRole !== 'admin') {
          const userDepartmentCheck = await client.query(
            `SELECT 1 FROM user_departments WHERE user_id = $1 AND department_id = $2`,
            [payload.sub, defaultDepartmentId]
          );

          if (userDepartmentCheck.rows.length === 0) {
            return NextResponse.json(
              { error: 'Sie sind nicht berechtigt, diese Abteilung als Standard-Abteilung zu setzen' },
              { status: 403 }
            );
          }
        }

        // Prüfe, ob Abteilung aktiv ist
        if (!department.is_active) {
          return NextResponse.json(
            { error: 'Abteilung ist nicht aktiv und kann nicht als Standard-Abteilung gesetzt werden' },
            { status: 400 }
          );
        }
      }

      const layoutPreferencesJson = layoutPreferencesPayload !== undefined && layoutPreferencesPayload !== null
        ? JSON.stringify(layoutPreferencesPayload)
        : null;

      // Company-Filter speichern (Einstellungen > Filter): in company_config schreiben
      if (emailFilters !== undefined) {
        try {
          await client.query(
            `UPDATE company_config SET email_filters = $1::jsonb, updated_at = NOW() WHERE id = 'company_config'`,
            [JSON.stringify(emailFilters || [])]
          );
        } catch (e) {
          // Spalte email_filters existiert ggf. noch nicht (Migration läuft später)
        }
      }

      // Aktualisiere oder erstelle Einstellungen (layout_preferences: Merge mit bestehendem bei UPDATE)
      await client.query(
        `INSERT INTO user_settings (user_id, fetch_interval_minutes, email_filters, table_columns, search_fields, default_department_id, layout_preferences, updated_at)
         VALUES ($1, $2, $3::jsonb, $4::jsonb, $5::jsonb, $6, COALESCE($7::jsonb, '{}'::jsonb), NOW())
         ON CONFLICT (user_id) 
         DO UPDATE SET 
           fetch_interval_minutes = COALESCE($2, user_settings.fetch_interval_minutes),
           email_filters = COALESCE($3::jsonb, user_settings.email_filters),
           table_columns = COALESCE($4::jsonb, user_settings.table_columns),
           search_fields = COALESCE($5::jsonb, user_settings.search_fields),
           default_department_id = COALESCE($6, user_settings.default_department_id),
           layout_preferences = user_settings.layout_preferences || COALESCE($7::jsonb, '{}'::jsonb),
           updated_at = NOW()`,
        [
          payload.sub,
          fetchIntervalMinutes || null,
          emailFilters !== undefined ? JSON.stringify(emailFilters || []) : null,
          tableColumns !== undefined ? JSON.stringify(tableColumns || []) : null,
          searchFields !== undefined ? JSON.stringify(searchFields || ['subject', 'from', 'body']) : null,
          defaultDepartmentId !== undefined ? defaultDepartmentId : null,
          layoutPreferencesJson,
        ]
      );

      // Lade aktualisierte Einstellungen
      const result = await client.query(
        `SELECT fetch_interval_minutes, email_filters, table_columns, search_fields, default_department_id, layout_preferences
         FROM user_settings
         WHERE user_id = $1`,
        [payload.sub]
      );

      let loadedLayoutPreferences: Record<string, unknown> = {};
      if (result.rows[0]?.layout_preferences != null) {
        try {
          loadedLayoutPreferences = typeof result.rows[0].layout_preferences === 'object'
            ? (result.rows[0].layout_preferences as Record<string, unknown>)
            : (JSON.parse(result.rows[0].layout_preferences as string) as Record<string, unknown>);
        } catch {
          loadedLayoutPreferences = {};
        }
      }
      
      // Lade aktualisierte Company-Config
      const updatedCompanyConfig = await getCompanyConfig(client);

      // Lade tableColumns aus DB (überschreibt den Wert aus dem Request-Body)
      let loadedTableColumns: any[] = [];
      if (result.rows[0]?.table_columns) {
        try {
          const parsedColumns = Array.isArray(result.rows[0].table_columns) 
            ? result.rows[0].table_columns 
            : JSON.parse(result.rows[0].table_columns);
          
          // Entferne die alte redundante Spalte 'participants_detailed'
          loadedTableColumns = parsedColumns.filter((col: any) => col.id !== 'participants_detailed');
          
          // Füge die Spalte "Abteilung" hinzu, falls sie fehlt
          const hasDepartmentColumn = loadedTableColumns.some((col: any) => col.id === 'department');
          if (!hasDepartmentColumn) {
            loadedTableColumns.push({ id: 'department', label: 'Abteilung', visible: true, order: 10, width: '150px' });
            // Sortiere nach order
            loadedTableColumns.sort((a: any, b: any) => a.order - b.order);
          }
        } catch {
          loadedTableColumns = [];
        }
      }
      
      // Falls keine Spalten in DB, verwende die aus dem Request-Body oder Default
      if (loadedTableColumns.length === 0 && tableColumns && Array.isArray(tableColumns)) {
        loadedTableColumns = tableColumns.filter((col: any) => col.id !== 'participants_detailed');
        
        // Füge die Spalte "Abteilung" hinzu, falls sie fehlt
        const hasDepartmentColumn = loadedTableColumns.some((col: any) => col.id === 'department');
        if (!hasDepartmentColumn) {
          loadedTableColumns.push({ id: 'department', label: 'Abteilung', visible: true, order: 10, width: '150px' });
          // Sortiere nach order
          loadedTableColumns.sort((a: any, b: any) => a.order - b.order);
        }
      }
      
      // Falls immer noch leer, verwende Default
      if (loadedTableColumns.length === 0) {
        loadedTableColumns = [
          { id: 'subject', label: 'Betreff', visible: true },
          { id: 'from', label: 'Von', visible: true },
          { id: 'to', label: 'An', visible: true },
          { id: 'date', label: 'Datum', visible: true },
          { id: 'read', label: 'Gelesen', visible: true },
        ];
      }

      // Lade searchFields aus DB (überschreibt den Wert aus dem Request-Body)
      const defaultSearchFields = ['subject', 'from', 'body'];
      let loadedSearchFields: string[] = defaultSearchFields;
      if (result.rows[0]?.search_fields) {
        try {
          const parsedFields = Array.isArray(result.rows[0].search_fields) 
            ? result.rows[0].search_fields 
            : JSON.parse(result.rows[0].search_fields);
          if (Array.isArray(parsedFields) && parsedFields.length > 0) {
            loadedSearchFields = parsedFields;
          }
        } catch {
          loadedSearchFields = defaultSearchFields;
        }
      }
      
      // Falls keine Felder in DB, verwende die aus dem Request-Body oder Default
      if (loadedSearchFields.length === 0 && searchFields && Array.isArray(searchFields)) {
        loadedSearchFields = searchFields;
      }
      
      // Falls immer noch leer, verwende Default
      if (loadedSearchFields.length === 0) {
        loadedSearchFields = defaultSearchFields;
      }

      return NextResponse.json({
        success: true,
        settings: {
          fetchIntervalMinutes: result.rows[0]?.fetch_interval_minutes || 5,
          emailFilters: result.rows[0]?.email_filters || [],
          tableColumns: loadedTableColumns,
          searchFields: loadedSearchFields,
          defaultDepartmentId: result.rows[0]?.default_department_id || null,
          layoutPreferences: loadedLayoutPreferences,
          openaiApiKey: updatedCompanyConfig.openaiApiKey,
          openaiModel: updatedCompanyConfig.openaiModel,
          elevenlabsApiKey: updatedCompanyConfig.elevenlabsApiKey,
          elevenlabsVoiceId: updatedCompanyConfig.elevenlabsVoiceId,
          elevenlabsEnabled: updatedCompanyConfig.elevenlabsEnabled ?? false,
          themeRequired: updatedCompanyConfig.themeRequired ?? false,
          permanentDeleteAfterDays: updatedCompanyConfig.permanentDeleteAfterDays ?? 0,
        },
      });
    } finally {
      client.release();
    }
  } catch (error: any) {
    console.error('Fehler beim Speichern der Einstellungen:', error);
    const message = process.env.NODE_ENV === 'development' && error?.message
      ? error.message
      : 'Interner Serverfehler';
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}

