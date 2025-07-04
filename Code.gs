class Candidate {
  constructor(data = {}) {
    this.id = data.id || Utilities.getUuid();
    const now = new Date();
    this.dateCreated = now.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
    this.timeCreated = now.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    this.fullName = data.fullName || '';
    this.phone = data.phone || '';
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
    this.company = 'ФК НСК';
    this.isReferral = data.isReferral || 'Нет';
    this.referralName = data.referralName || '';
    this.fillDate = data.fillDate || '';
    this.hasMedicalBook = data.hasMedicalBook || 'Нет';
    this.scheduleExplained = data.scheduleExplained || 'Нет';
    this.paymentExplained = data.paymentExplained || 'Нет';
    this.recommendation = data.recommendation || '';
    this.interviewComment = data.interviewComment || '';
    this.refusalComment = data.refusalComment || '';
  }

  toRow() {
    return [
      this.id, this.dateCreated, this.timeCreated, this.fullName, "'" + this.phone,
      this.position, this.age, this.citizenship, this.status, this.interviewDate, this.interviewTime,
      this.followupDate, this.followupTime, this.source, this.recruiter, this.callType, this.comment,
      this.company, this.isReferral, this.referralName, this.fillDate, this.hasMedicalBook,
      this.scheduleExplained, this.paymentExplained, this.recommendation, this.interviewComment,
      this.refusalComment
    ];
  }
}

function getSpreadsheet() {
  return SpreadsheetApp.openById('1rsTqSA8hrYMgoMDntq3qs-JawEUFwkIDFimLY9Q2KJo');
}

function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('HR Форма для Фабрика НСК')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

function getSupportData() {
  const sheet = getSpreadsheet().getSheetByName('support');
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return { status: 'success', positions: [], sources: [], recruiters: [] };
  }
  const data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
  const positions = data.map(row => row[0]).filter(String);
  const sources = data.map(row => row[1]).filter(String);
  const recruiters = data.map(row => row[2]).filter(String);
  return { status: 'success', positions, sources, recruiters };
}

function saveCandidate(data) {
  try {
    const sheet = getSpreadsheet().getSheetByName('Анкеты') || getSpreadsheet().insertSheet('Анкеты');
    const headers = [
      'ID', 'Дата создания', 'Время создания', 'ФИО', 'Телефон', 'Должность', 'Возраст', 'Гражданство', 'Статус',
      'Дата собеседования', 'Время собеседования', 'Дата связи', 'Время связи', 'Источник', 'Рекрутер', 'Тип звонка',
      'Комментарий', 'Предприятие', 'Реферальная', 'Фамилия реферала', 'Дата заполнения', 'Мед. книжка',
      'Рассказано про график', 'Рассказано про оплату', 'Рекомендация', 'Комментарий после собеседования',
      'Комментарий отказа'
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
      fullName: String(row[3]).trim(),
      phone: String(row[4]).trim(),
      position: String(row[5]).trim(),
      comment: String(row[16]).trim(),
      refusalComment: String(row[26]).trim(),
      status: row[8],
      followupDate: row[11] ? row[11].split('.').reverse().join('-') : '',
      followupTime: row[12] || ''
    }));
    return { status: 'success', interviews: result };
  } catch (e) {
    return { status: 'error', message: `Ошибка загрузки: ${e.message}` };
  }
}

function getInterviewsByDate(date) {
  return getFilteredData('Анкеты', ['Назначено собеседование', 'Связаться позже'], date);
}

function getInternshipsByDate(date) {
  return getFilteredData('Анкеты', ['Назначена стажировка'], date);
}

function updateStatuses(updates, validStatuses) {
  try {
    const sheet = getSpreadsheet().getSheetByName('Анкеты');
    const data = sheet.getDataRange().getValues();
    updates.forEach(update => {
      if (!validStatuses.includes(update.status)) throw new Error(`Недопустимый статус: ${update.status}`);
      const rowIndex = data.findIndex(row => row[0] === update.id);
      if (rowIndex === -1) throw new Error(`Кандидат ${update.id} не найден`);
      const oldStatus = data[rowIndex][8];
      if (oldStatus !== update.status) {
        sheet.getRange(rowIndex + 1, 9).setValue(update.status);
        sheet.getRange(rowIndex + 1, 12).setValue(update.status === 'Связаться позже' ? update.followupDate.split('-').reverse().join('.') : '');
        sheet.getRange(rowIndex + 1, 13).setValue(update.status === 'Связаться позже' ? update.followupTime : '');
        sheet.getRange(rowIndex + 1, 10).setValue('');
        sheet.getRange(rowIndex + 1, 11).setValue('');
        sheet.getRange(rowIndex + 1, 27).setValue(['Кандидат отказался', 'Отказано кандидату'].includes(update.status) ? update.refusalComment : '');
        sheet.getRange(rowIndex + 1, 10, 1, 2).setNumberFormat('@');
        sheet.getRange(rowIndex + 1, 12, 1, 2).setNumberFormat('@');
        logStatusChange(update.id, oldStatus, update.status, update.recruiter, `Изменение статуса ${validStatuses.includes('Назначена стажировка') ? 'стажировки' : 'собеседования'}`);
      }
    });
    return { status: 'success' };
  } catch (e) {
    return { status: 'error', message: `Ошибка сохранения: ${e.message}` };
  }
}

function updateInterviewStatuses(updates) {
  return updateStatuses(updates, ['Назначено собеседование', 'Связаться позже', 'Кандидат отказался', 'Отказано кандидату']);
}

function updateInternshipStatuses(updates) {
  return updateStatuses(updates, ['Связаться позже', 'Кандидат отказался', 'Отказано кандидату']);
}

function getCandidateById(id) {
  try {
    const sheet = getSpreadsheet().getSheetByName('Анкеты');
    if (!sheet) return { status: 'error', message: 'Лист "Анкеты" не найден' };
    const data = sheet.getDataRange().getValues();
    const headers = data[0];
    const row = data.slice(1).find(row => row[0] === id);
    if (!row) return { status: 'error', message: 'Кандидат не найден' };
    return {
      status: 'success',
      data: new Candidate({
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
        refusalComment: row[headers.indexOf('Комментарий отказа')] || ''
      }).toRow()
    };
  } catch (e) {
    return { status: 'error', message: `Ошибка: ${e.message}` };
  }
}

function saveInterview(data) {
  try {
    const sheet = getSpreadsheet().getSheetByName('Анкеты');
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
    return { status: 'success' };
  } catch (e) {
    return { status: 'error', message: `Ошибка сохранения: ${e.message}` };
  }
}
