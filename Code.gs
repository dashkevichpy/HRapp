const COMPANY_NAME = 'ФК НСК';
const SUPPORT_SHEET_NAME = 'support';
const SUPPORT_START_ROW = 2;
const POSITION_COL = 1;
const SOURCE_COL = 2;
const RECRUITER_COL = 3;
const CANDIDATE_SHEET_NAME = 'Анкеты';
const CACHE_EXPIRATION = 21600; // 6 hours
const cache = CacheService.getScriptCache();
const SPREADSHEET_ID = '1rsTqSA8hrYMgoMDntq3qs-JawEUFwkIDFimLY9Q2KJo';
let spreadsheet = null;
const TOTAL_COLS = 35;
const LAST_COL_LETTER = 'AI';

class Candidate {
  constructor(data = {}) {
    this.id = data.id || Utilities.getUuid();
    const now = new Date();
    this.dateCreated = now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    this.timeCreated = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    this.fullName = data.fullName || '';
    this.phone = data.phone ? String(data.phone).replace(/^'/, '') : '';
    this.position = data.position || '';
    this.age = data.age || '';
    this.citizenship = data.citizenship || '';
    this.status = data.status || '';
    this.interviewDate = data.interviewDate || '';
    this.interviewTime = data.interviewTime || '';
    this.followupDate = data.followupDate || '';
    this.followupTime = data.followupTime || '';
    this.source = data.source || '';
    this.recruiter = data.recruiter || '';
    this.callType = data.callType || 'Входящий';
    this.comment = data.comment || '';
    this.company = COMPANY_NAME;
    this.isReferral = data.isReferral || 'Нет';
    this.referralName = data.referralName || '';
    this.fillDate = data.fillDate || '';
    this.hasMedicalBook = data.hasMedicalBook || 'Нет';
    this.scheduleExplained = data.scheduleExplained || 'Нет';
    this.paymentExplained = data.paymentExplained || 'Нет';
    this.recommendation = data.recommendation || '';
    this.interviewComment = data.interviewComment || '';
    this.refusalComment = data.refusalComment || '';
    this.internshipFillDate = data.internshipFillDate || '';
    this.medicalBookSubmitted = data.medicalBookSubmitted || 'Нет';
    this.apprenticeshipContract = data.apprenticeshipContract || 'Нет';
    this.dataProcessingConsent = data.dataProcessingConsent || 'Нет';
    this.inspectionConsent = data.inspectionConsent || 'Нет';
    this.internshipFormCompleted = data.internshipFormCompleted || 'Нет';
    this.medicalExamExpiration = data.medicalExamExpiration || '';
    this.sanitaryExpiration = data.sanitaryExpiration || '';
  }

  toRow() {
    return [
      this.id, this.dateCreated, this.timeCreated, this.fullName, "'" + this.phone,
      this.position, this.age, this.citizenship, this.status, this.interviewDate, this.interviewTime,
      this.followupDate, this.followupTime, this.source, this.recruiter, this.callType, this.comment,
      this.company, this.isReferral, this.referralName, this.fillDate, this.hasMedicalBook,
      this.scheduleExplained, this.paymentExplained, this.recommendation, this.interviewComment,
      this.refusalComment, this.internshipFillDate, this.medicalBookSubmitted,
      this.apprenticeshipContract, this.dataProcessingConsent, this.inspectionConsent,
      this.internshipFormCompleted, this.medicalExamExpiration, this.sanitaryExpiration
    ];
  }
}

function computeHash(row) {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, row.join('|'));
  return bytes.map(b => ('0' + (b & 0xff).toString(16)).slice(-2)).join('');
}

function setCandidateCache(candidate) {
  const row = candidate.toRow();
  const hash = computeHash(row);
  cache.put('cand_' + candidate.id, JSON.stringify({ row, hash }), CACHE_EXPIRATION);
  return { row, hash };
}

function getCandidateCache(id) {
  const cached = cache.get('cand_' + id);
  return cached ? JSON.parse(cached) : null;
}

function getSpreadsheet() {
  if (!spreadsheet) {
    spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  }
  return spreadsheet;
}

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('HR Форма для ' + COMPANY_NAME)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getSupportData() {
  const cached = cache.get('support_data');
  if (cached) return JSON.parse(cached);
  const sheet = getSpreadsheet().getSheetByName(SUPPORT_SHEET_NAME);
  const lastRow = sheet.getLastRow();
  let result;
  if (lastRow < SUPPORT_START_ROW) {
    result = { status: 'success', positions: [], sources: [], recruiters: [] };
  } else {
    const data = sheet.getRange(SUPPORT_START_ROW, POSITION_COL, lastRow - SUPPORT_START_ROW + 1, 3).getValues();
    const positions  = data.map(row => row[POSITION_COL - 1]).filter(String);
    const sources    = data.map(row => row[SOURCE_COL - 1]).filter(String);
    const recruiters = data.map(row => row[RECRUITER_COL - 1]).filter(String);
    result = { status: 'success', positions, sources, recruiters };
  }
  cache.put('support_data', JSON.stringify(result), CACHE_EXPIRATION);
  return result;
}

function saveCandidate(data) {
  try {
    const sheet = getSpreadsheet().getSheetByName(CANDIDATE_SHEET_NAME) || getSpreadsheet().insertSheet(CANDIDATE_SHEET_NAME);
    const headers = [
      'ID', 'Дата создания', 'Время создания', 'ФИО', 'Телефон', 'Должность', 'Возраст', 'Гражданство', 'Статус',
      'Дата собеседования', 'Время собеседования', 'Дата связи', 'Время связи', 'Источник', 'Рекрутер', 'Тип звонка',
      'Комментарий', 'Предприятие', 'Реферальная', 'Фамилия реферала', 'Дата заполнения', 'Мед. книжка',
      'Рассказано про график', 'Рассказано про оплату', 'Рекомендация', 'Комментарий после собеседования',
      'Комментарий отказа', 'Дата анкеты стажировки', 'Мед. книжка сдана', 'Ученич. договор подписан',
      'Согласие на обработку', 'Согласие на осмотр', 'Анкета стажировки заполнена',
      'Окончание медосмотра', 'Окончание санминимума'
    ];
    if (!sheet.getLastRow()) sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

    const candidate = new Candidate({
      ...data,
      interviewDate: data.status === 'Назначено собеседование' && data.interviewDate ? data.interviewDate.split('-').reverse().join('.') : '',
      interviewTime: data.status === 'Назначено собеседование' ? data.interviewTime : '',
      followupDate: data.status === 'Связаться позже' && data.followupDate ? data.followupDate.split('-').reverse().join('.') : '',
      followupTime: data.status === 'Связаться позже' ? data.followupTime : '',
      refusalComment: data.refusalComment || ''
    });

    sheet.appendRow(candidate.toRow());
    setCandidateCache(candidate);
    sheet.getRange(sheet.getLastRow(), 2, 1, 3).setNumberFormat('@');
    sheet.getRange(sheet.getLastRow(), 10, 1, 2).setNumberFormat('@');
    sheet.getRange(sheet.getLastRow(), 12, 1, 2).setNumberFormat('@');

    logStatusChange(candidate.id, '', candidate.status, candidate.recruiter, 'Создание анкеты');
    return { status: 'success', id: candidate.id };
  } catch (e) {
    return { status: 'error', message: `Ошибка сохранения: ${e.message}` };
  }
}

function logStatusChange(id, oldStatus, newStatus, recruiter, comment) {
  const logSheet = getSpreadsheet().getSheetByName('log') || getSpreadsheet().insertSheet('log');
  const headers = ['ID', 'ID_сотрудника', 'Был статус', 'Стал статус', 'Дата перехода', 'Комментарий', 'Кто изменил статус'];
  if (!logSheet.getLastRow()) logSheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  logSheet.appendRow([
    Utilities.getUuid(),
    id,
    oldStatus,
    newStatus,
    new Date().toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' }),
    comment,
    recruiter
  ]).getRange(logSheet.getLastRow(), 5).setNumberFormat('@');
}

function getFilteredData(sheetName, status, date) {
  try {
    const sheet = getSpreadsheet().getSheetByName(sheetName);
    if (!sheet) return { status: 'success', interviews: [] };

    const formattedDate = date ? date.split('-').reverse().join('.') : '';
    const data = sheet.getDataRange().getValues();
    const result = data.slice(1).filter(row =>
      status.includes(row[8]) && (!formattedDate || (
        ['Назначено собеседование', 'Назначена стажировка'].includes(row[8]) ? row[9] : row[11]
      ) === formattedDate)
    ).map(row => ({
      id: row[0],
      dateTime: `${['Назначено собеседование', 'Назначена стажировка'].includes(row[8]) ? row[9] : row[11]} ${['Назначено собеседование', 'Назначена стажировка'].includes(row[8]) ? row[10] : row[12]}`,
      interviewDate: row[9] ? row[9].split('.').reverse().join('-') : '',
      interviewTime: row[10] || '',
      fullName: String(row[3]).trim(),
      phone: String(row[4]).trim(),
      position: String(row[5]).trim(),
      comment: String(row[16]).trim(),
      refusalComment: String(row[26]).trim(),
      status: row[8],
      followupDate: row[11] ? row[11].split('.').reverse().join('-') : '',
      followupTime: row[12] || ''
    })).sort((a, b) => {
      const getDate = obj => {
        const date = obj.interviewDate || obj.followupDate || '';
        const time = obj.interviewDate ? obj.interviewTime : obj.followupTime;
        return new Date(`${date}T${time || '00:00'}`);
      };
      return getDate(a) - getDate(b);
    });
    return { status: 'success', interviews: result };
  } catch (e) {
    return { status: 'error', message: `Ошибка загрузки: ${e.message}` };
  }
}

function getInterviewsByDate(date) {
  return getFilteredData(CANDIDATE_SHEET_NAME, ['Назначено собеседование', 'Связаться позже'], date);
}

function getInternshipsByDate(date) {
  return getFilteredData(CANDIDATE_SHEET_NAME, ['Назначена стажировка'], date);
}

function updateStatuses(updates, validStatuses) {
  try {
    const sheet = getSpreadsheet().getSheetByName(CANDIDATE_SHEET_NAME);
    const data = sheet.getDataRange().getValues();
    const idMap = new Map();
    for (let i = 1; i < data.length; i++) {
      idMap.set(data[i][0], i);
    }
    const ranges = [];
    const values = [];
    const formatRanges = [];
    const cacheKeys = [];
    updates.forEach(update => {
      if (!validStatuses.includes(update.status)) throw new Error(`Недопустимый статус: ${update.status}`);
      const rowIndex = idMap.get(update.id);
      if (rowIndex === undefined) throw new Error(`Кандидат ${update.id} не найден`);
      const row = data[rowIndex].slice();
      const oldStatus = row[8];
      if (oldStatus !== update.status) {
        row[8] = update.status;
        row[26] = ['Кандидат отказался', 'Отказано кандидату'].includes(update.status) ? update.refusalComment : '';
        logStatusChange(update.id, oldStatus, update.status, update.recruiter,
          `Изменение статуса ${validStatuses.includes('Назначена стажировка') || validStatuses.includes('Принят на работу') ? 'стажировки' : 'собеседования'}`);
      }
      if (update.status === 'Связаться позже') {
        row[11] = update.followupDate.split('-').reverse().join('.');
        row[12] = update.followupTime;
        row[9] = '';
        row[10] = '';
      } else if (update.status === 'Назначена стажировка') {
        row[9] = update.interviewDate.split('-').reverse().join('.');
        row[10] = update.interviewTime;
        row[11] = '';
        row[12] = '';
      } else {
        row[9] = '';
        row[10] = '';
        row[11] = '';
        row[12] = '';
      }
      ranges.push(`A${rowIndex + 1}:${LAST_COL_LETTER}${rowIndex + 1}`);
      values.push(row);
      formatRanges.push(`J${rowIndex + 1}:M${rowIndex + 1}`);
      cacheKeys.push('cand_' + update.id);
    });
    if (ranges.length) {
      sheet.getRangeList(ranges).setValues(values);
      sheet.getRangeList(formatRanges).setNumberFormat('@');
      cache.removeAll(cacheKeys);
    }
    return { status: 'success' };
  } catch (e) {
    return { status: 'error', message: `Ошибка сохранения: ${e.message}` };
  }
}

function updateInterviewStatuses(updates) {
  return updateStatuses(updates, ['Назначено собеседование', 'Связаться позже', 'Кандидат отказался', 'Отказано кандидату']);
}

function updateInternshipStatuses(updates) {
  return updateStatuses(updates, ['Назначена стажировка', 'Связаться позже', 'Кандидат отказался', 'Отказано кандидату', 'Принят на работу']);
}

function getCandidateById(id) {
  try {
    const cached = getCandidateCache(id);
    if (cached) return { status: 'success', data: cached.row };

    const sheet = getSpreadsheet().getSheetByName(CANDIDATE_SHEET_NAME);
    if (!sheet) return { status: 'error', message: 'Лист "Анкеты" не найден' };
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const row = data.slice(1).find(r => r[0] === id);
    if (!row) return { status: 'error', message: 'Кандидат не найден' };
    const candidate = new Candidate({
        id: row[headers.indexOf('ID')],
        dateCreated: row[headers.indexOf('Дата создания')],
        timeCreated: row[headers.indexOf('Время создания')],
        fullName: row[headers.indexOf('ФИО')],
        phone: row[headers.indexOf('Телефон')],
        position: row[headers.indexOf('Должность')],
        age: row[headers.indexOf('Возраст')],
        citizenship: row[headers.indexOf('Гражданство')],
        status: row[headers.indexOf('Статус')],
        interviewDate: row[headers.indexOf('Дата собеседования')],
        interviewTime: row[headers.indexOf('Время собеседования')],
        followupDate: row[headers.indexOf('Дата связи')],
        followupTime: row[headers.indexOf('Время связи')],
        source: row[headers.indexOf('Источник')],
        recruiter: row[headers.indexOf('Рекрутер')],
        callType: row[headers.indexOf('Тип звонка')],
        comment: row[headers.indexOf('Комментарий')],
        isReferral: row[headers.indexOf('Реферальная')] || 'Нет',
        referralName: row[headers.indexOf('Фамилия реферала')] || '',
        fillDate: row[headers.indexOf('Дата заполнения')] || '',
        hasMedicalBook: row[headers.indexOf('Мед. книжка')] || 'Нет',
        scheduleExplained: row[headers.indexOf('Рассказано про график')] || 'Нет',
        paymentExplained: row[headers.indexOf('Рассказано про оплату')] || 'Нет',
        recommendation: row[headers.indexOf('Рекомендация')] || '',
        interviewComment: row[headers.indexOf('Комментарий после собеседования')] || '',
        refusalComment: row[headers.indexOf('Комментарий отказа')] || '',
        internshipFillDate: row[headers.indexOf('Дата анкеты стажировки')] || '',
        medicalBookSubmitted: row[headers.indexOf('Мед. книжка сдана')] || 'Нет',
        apprenticeshipContract: row[headers.indexOf('Ученич. договор подписан')] || 'Нет',
        dataProcessingConsent: row[headers.indexOf('Согласие на обработку')] || 'Нет',
        inspectionConsent: row[headers.indexOf('Согласие на осмотр')] || 'Нет',
        internshipFormCompleted: row[headers.indexOf('Анкета стажировки заполнена')] || 'Нет',
        medicalExamExpiration: row[headers.indexOf('Окончание медосмотра')] || '',
        sanitaryExpiration: row[headers.indexOf('Окончание санминимума')] || ''
        });
    const cachedData = setCandidateCache(candidate);
    return { status: 'success', data: cachedData.row };
  } catch (e) {
    return { status: 'error', message: `Ошибка: ${e.message}` };
  }
}

function saveInterview(data) {
  try {
    const sheet = getSpreadsheet().getSheetByName(CANDIDATE_SHEET_NAME);
    if (!sheet) return { status: 'error', message: 'Лист "Анкеты" не найден' };
    const dataRange = sheet.getDataRange().getValues();
    const headers = dataRange[0];
    const rowIndex = dataRange.findIndex(row => row[0] === data.id);
    if (rowIndex === -1) return { status: 'error', message: 'Кандидат не найден' };
    if (!data.fillDate) {
      data.fillDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    }
    const candidate = new Candidate({
      id: data.id,
      dateCreated: dataRange[rowIndex][headers.indexOf('Дата создания')],
      timeCreated: dataRange[rowIndex][headers.indexOf('Время создания')],
      fullName: data.fullName,
      phone: data.phone,
      position: data.position,
      age: data.age,
      citizenship: data.citizenship,
      status: data.status,
      interviewDate: data.status === 'Назначена стажировка' ? data.statusDate.split('-').reverse().join('.') : dataRange[rowIndex][headers.indexOf('Дата собеседования')],
      interviewTime: data.status === 'Назначена стажировка' ? data.statusTime : dataRange[rowIndex][headers.indexOf('Время собеседования')],
      followupDate: data.status === 'Связаться позже' ? data.statusDate.split('-').reverse().join('.') : dataRange[rowIndex][headers.indexOf('Дата связи')],
      followupTime: data.status === 'Связаться позже' ? data.statusTime : dataRange[rowIndex][headers.indexOf('Время связи')],
      source: data.source,
      recruiter: data.recruiter,
      callType: data.callType,
      comment: dataRange[rowIndex][headers.indexOf('Комментарий')],
      refusalComment: dataRange[rowIndex][headers.indexOf('Комментарий отказа')],
      isReferral: data.isReferral,
      referralName: data.referralName,
      fillDate: data.fillDate,
      hasMedicalBook: data.hasMedicalBook,
      scheduleExplained: data.scheduleExplained,
      paymentExplained: data.paymentExplained,
      recommendation: data.recommendation,
      interviewComment: data.interviewComment
    });

    sheet.getRange(rowIndex + 1, 1, 1, headers.length).setValues([candidate.toRow()]);
    sheet.getRange(rowIndex + 1, 2, 1, 3).setNumberFormat('@');
    sheet.getRange(rowIndex + 1, 10, 1, 2).setNumberFormat('@');
    sheet.getRange(rowIndex + 1, 12, 1, 2).setNumberFormat('@');
    logStatusChange(data.id, dataRange[rowIndex][headers.indexOf('Статус')], data.status, data.recruiter, 'Изменение после собеседования');
    setCandidateCache(candidate);
    return { status: 'success' };
  } catch (e) {
    return { status: 'error', message: `Ошибка сохранения: ${e.message}` };
  }
}

function saveInternship(data) {
  try {
    const sheet = getSpreadsheet().getSheetByName(CANDIDATE_SHEET_NAME);
    if (!sheet) return { status: 'error', message: 'Лист "Анкеты" не найден' };
    const dataRange = sheet.getDataRange().getValues();
    const headers = dataRange[0];
    const rowIndex = dataRange.findIndex(row => row[0] === data.id);
    if (rowIndex === -1) return { status: 'error', message: 'Кандидат не найден' };
    data.internshipFillDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    const rowData = dataRange[rowIndex];
    const candidate = new Candidate({
      id: data.id,
      dateCreated: rowData[headers.indexOf('Дата создания')],
      timeCreated: rowData[headers.indexOf('Время создания')],
      fullName: data.fullName,
      phone: data.phone,
      position: data.position,
      age: data.age,
      citizenship: data.citizenship,
      status: data.status,
      interviewDate: rowData[headers.indexOf('Дата собеседования')],
      interviewTime: rowData[headers.indexOf('Время собеседования')],
      followupDate: rowData[headers.indexOf('Дата связи')],
      followupTime: rowData[headers.indexOf('Время связи')],
      followupDate: data.status === 'Связаться позже' ? data.statusDate.split('-').reverse().join('.') : rowData[headers.indexOf('Дата связи')],
      followupTime: data.status === 'Связаться позже' ? data.statusTime : rowData[headers.indexOf('Время связи')],
      source: data.source,
      recruiter: data.recruiter,
      callType: data.callType,
      comment: data.comment,
      isReferral: data.isReferral,
      referralName: data.referralName,
      fillDate: rowData[headers.indexOf('Дата заполнения')] || '',
      hasMedicalBook: data.hasMedicalBook,
      scheduleExplained: data.scheduleExplained,
      paymentExplained: data.paymentExplained,
      recommendation: data.recommendation,
      interviewComment: data.interviewComment,
      refusalComment: data.refusalComment || rowData[headers.indexOf('Комментарий отказа')] || '',
      internshipFillDate: data.internshipFillDate,
      medicalBookSubmitted: data.medicalBookSubmitted,
      apprenticeshipContract: data.apprenticeshipContract,
      dataProcessingConsent: data.dataProcessingConsent,
      inspectionConsent: data.inspectionConsent,
      internshipFormCompleted: data.internshipFormCompleted,
      medicalExamExpiration: data.medicalExamExpiration,
      sanitaryExpiration: data.sanitaryExpiration
    });
    sheet.getRange(rowIndex + 1, 1, 1, headers.length).setValues([candidate.toRow()]);
    sheet.getRange(rowIndex + 1, 2, 1, 3).setNumberFormat('@');
    sheet.getRange(rowIndex + 1, 10, 1, 2).setNumberFormat('@');
    sheet.getRange(rowIndex + 1, 12, 1, 2).setNumberFormat('@');
    logStatusChange(data.id, rowData[headers.indexOf('Статус')], data.status, data.recruiter, 'Изменение после стажировки');
    setCandidateCache(candidate);
    return { status: 'success' };
  } catch (e) {
    return { status: 'error', message: `Ошибка сохранения: ${e.message}` };
  }
}
