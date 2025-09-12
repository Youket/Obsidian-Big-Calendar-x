import {TFile, normalizePath, Notice} from 'obsidian';
import {moment} from 'obsidian';
import {createDailyNote, getAllDailyNotes, getDailyNote} from 'obsidian-daily-notes-interface';
import {insertAfterHandler} from './createEvent';
import fileService from '../services/fileService';
import {getAllLinesFromFile, getDailyNotePath, safeExecute} from '../api';
import {extractDeletedEventId, extractDeletedEvent, extractDeletedEventDate} from '../utils/regexGenerators';

/**
 * Restores a deleted event from the delete.md file back to its original daily note
 *
 * @param deletedEventid The ID of the deleted event to restore
 * @returns Promise resolving to an array with the restored event info
 */
export async function restoreDeletedEvent(deletedEventid: string): Promise<any[]> {
  return await safeExecute(async () => {
    const {vault, metadataCache} = fileService.getState().app;

    if (!/\d{14,}/.test(deletedEventid)) {
      throw new Error('Invalid event ID format');
    }

    const filePath = getDailyNotePath();
    const absolutePath = filePath + '/delete.md';
    const deleteFile = metadataCache.getFirstLinkpathDest('', absolutePath);

    if (!(deleteFile instanceof TFile)) {
      throw new Error('Delete file not found');
    }

    const fileContents = await vault.read(deleteFile);
    const fileLines = getAllLinesFromFile(fileContents);

    if (fileLines.length === 0) {
      return [];
    }

    const lineNum = parseInt(deletedEventid.slice(14));
    const line = fileLines[lineNum - 1];
    const newDeletefileContents = fileContents.replace(line, '');
    await vault.modify(deleteFile, newDeletefileContents);

    if (!/^- (.+)$/.test(line)) {
      return [];
    }

    const id = extractDeletedEventId(line);
    const date = moment(id, 'YYYYMMDDHHmmss');
    const timeHour = date.format('HH');
    const timeMinute = date.format('mm');

    const newEvent = `- ${timeHour}:${timeMinute} ${extractDeletedEvent(line)}`;
    const dailyNotes = await getAllDailyNotes();
    const existingFile = getDailyNote(date, dailyNotes);

    if (!existingFile) {
      const file = await createDailyNote(date);
      const fileContents = await vault.read(file);
      const newFileContent = await insertAfterHandler('- ', newEvent, fileContents);
      await vault.modify(file, newFileContent.content);
    } else {
      const fileContents = await vault.read(existingFile);
      const newFileContent = await insertAfterHandler('- ', newEvent, fileContents);
      await vault.modify(existingFile, newFileContent.content);
    }

    return [{deletedAt: ''}];
  }, 'Failed to restore deleted event');
}

/**
 * Permanently deletes an event from the delete.md file
 *
 * @param deletedEventid The ID of the deleted event to remove permanently
 * @returns Promise resolving to void
 */
export async function deleteForever(deletedEventid: string): Promise<void> {
  return await safeExecute(async () => {
    const {vault, metadataCache} = fileService.getState().app;

    if (!/\d{14,}/.test(deletedEventid)) {
      throw new Error('Invalid event ID format');
    }

    const filePath = getDailyNotePath();
    const absolutePath = filePath + '/delete.md';
    const deleteFile = metadataCache.getFirstLinkpathDest('', absolutePath);

    if (!(deleteFile instanceof TFile)) {
      return;
    }

    const fileContents = await vault.read(deleteFile);
    const fileLines = getAllLinesFromFile(fileContents);

    if (fileLines.length === 0) {
      return;
    }

    const lineNum = parseInt(deletedEventid.slice(14));
    const line = fileLines[lineNum - 1];

    if (/^- (.+)$/.test(line)) {
      const newFileContent = fileContents.replace(line, '');
      await vault.modify(deleteFile, newFileContent);
    }
  }, 'Failed to permanently delete event');
}

/**
 * Retrieves all deleted events from the delete.md file
 *
 * @returns Promise resolving to an array of deleted events
 */
export async function getDeletedEvents(): Promise<any[]> {
  return await safeExecute(async () => {
    const {vault, metadataCache} = fileService.getState().app;
    const deletedEvents: any[] = [];

    const filePath = getDailyNotePath();
    const absolutePath = filePath + '/delete.md';
    const deleteFile = metadataCache.getFirstLinkpathDest('', absolutePath);

    if (!(deleteFile instanceof TFile)) {
      return deletedEvents;
    }

    const fileContents = await vault.read(deleteFile);
    const fileLines = getAllLinesFromFile(fileContents);

    if (fileLines.length === 0) {
      return deletedEvents;
    }

    for (let i = 0; i < fileLines.length; i++) {
      const line = fileLines[i];

      if (!/- /.test(line)) {
        continue;
      }

      const id = extractDeletedEventId(line);
      if (!id) continue;

      const timeString = id.slice(0, 13);
      const createdDate = moment(timeString, 'YYYYMMDDHHmmss');
      const deletedDateID = extractDeletedEventDate(line);
      if (!deletedDateID) continue;

      const deletedDate = moment(deletedDateID.slice(0, 13), 'YYYYMMDDHHmmss');
      const content = extractDeletedEvent(line);
      if (!content) continue;

      deletedEvents.push({
        id: deletedDateID,
        content: content,
        user_id: 1,
        createdAt: createdDate.format('YYYY/MM/DD HH:mm:SS'),
        updatedAt: createdDate.format('YYYY/MM/DD HH:mm:SS'),
        deletedAt: deletedDate,
      });
    }

    return deletedEvents;
  }, 'Failed to get deleted events');
}

/**
 * Sends an event to the delete.md file
 *
 * @param event The content of the event to delete
 * @returns Promise resolving to the deletion date
 */
export const sendEventToDelete = async (event: string): Promise<any> => {
  return await safeExecute(async () => {
    const {metadataCache, vault} = fileService.getState().app;

    const filePath = getDailyNotePath();
    const absolutePath = filePath + '/delete.md';
    const deleteFile = metadataCache.getFirstLinkpathDest('', absolutePath);

    const date = moment();
    const deleteDate = date.format('YYYY/MM/DD HH:mm:ss');

    if (deleteFile instanceof TFile) {
      const fileContents = await vault.read(deleteFile);
      const fileLines = getAllLinesFromFile(fileContents);

      let lineNum;
      if (fileLines.length === 1 && fileLines[0] === '') {
        lineNum = 1;
      } else {
        lineNum = fileLines.length + 1;
      }

      const deleteDateID = date.format('YYYYMMDDHHmmss') + lineNum;
      await createDeleteEventInFile(deleteFile, fileContents, event, deleteDateID);

      return deleteDate;
    } else {
      const deleteFilePath = normalizePath(absolutePath);
      const file = await createdeleteFile(deleteFilePath);

      const lineNum = 1;
      const deleteDateID = date.format('YYYYMMDDHHmmss') + lineNum;

      await createDeleteEventInFile(file, '', event, deleteDateID);

      return deleteDate;
    }
  }, 'Failed to send event to delete');
};

/**
 * Creates a deleted event entry in the delete.md file
 *
 * @param file The delete.md file
 * @param fileContent The current content of the file
 * @param event The content of the event to delete
 * @param deleteDate The deletion date
 * @returns Promise resolving to true if successful
 */
export const createDeleteEventInFile = async (
  file: TFile,
  fileContent: string,
  event: string,
  deleteDate: string,
): Promise<any> => {
  return await safeExecute(async () => {
    const {vault} = fileService.getState().app;
    let newContent;

    if (fileContent === '') {
      newContent = event + ' deletedAt: ' + deleteDate;
    } else {
      newContent = fileContent + '\n' + event + ' deletedAt: ' + deleteDate;
    }

    await vault.modify(file, newContent);

    return true;
  }, 'Failed to create delete event in file');
};

/**
 * Creates the delete.md file if it doesn't exist
 *
 * @param path The path where to create the file
 * @returns Promise resolving to the created file
 */
export const createdeleteFile = async (path: string): Promise<TFile> => {
  return await safeExecute(async () => {
    const {vault} = fileService.getState().app;

    try {
      const createdFile = await vault.create(path, '');
      return createdFile;
    } catch (err) {
      console.error(`Failed to create file: '${path}'`, err);
      new Notice('Unable to create new file.');
      throw err;
    }
  }, 'Failed to create delete file');
};

/**
 * 直接从日记文件中删除事件及其备注
 * 
 * @param eventId 事件ID，格式为 YYYYMMDDHHmm00lineIndex
 * @param eventPath 事件所在的文件路径
 * @param eventTitle 事件标题，用于匹配
 * @returns Promise<boolean> 删除是否成功
 */
export async function deleteEventFromDailyNote(eventId: string, eventPath: string, eventTitle?: string): Promise<boolean> {
  return await safeExecute(async () => {
    console.log('🗑️ [DELETE_EVENT] Starting deletion process');
    console.log('🗑️ [DELETE_EVENT] Event ID:', eventId);
    console.log('🗑️ [DELETE_EVENT] Event path:', eventPath);
    console.log('🗑️ [DELETE_EVENT] Event title:', eventTitle);

    const {vault, metadataCache} = fileService.getState().app;

    // 验证事件ID格式
    if (!/^\d{14,}$/.test(eventId)) {
      console.error('❌ [DELETE_EVENT] Invalid event ID format:', eventId);
      throw new Error('Invalid event ID format');
    }

    // 获取文件
    const file = metadataCache.getFirstLinkpathDest('', eventPath);
    if (!(file instanceof TFile)) {
      console.error('❌ [DELETE_EVENT] File not found:', eventPath);
      throw new Error(`File not found: ${eventPath}`);
    }

    console.log('✅ [DELETE_EVENT] File found:', file.path);

    // 读取文件内容
    const fileContents = await vault.read(file);
    const fileLines = getAllLinesFromFile(fileContents);
    
    console.log('📄 [DELETE_EVENT] Total lines in file:', fileLines.length);

    // 显示所有行内容用于调试
    console.log('📋 [DELETE_EVENT] All file lines:');
    fileLines.forEach((line, index) => {
      console.log(`   ${index}: ${line}`);
    });

    // 查找目标事件行 - 使用多种方法
    let targetLineIndex = -1;

    // 方法1：如果有事件标题，尝试通过标题匹配
    if (eventTitle) {
      console.log('🔍 [DELETE_EVENT] Trying to match by event title:', eventTitle);
      for (let i = 0; i < fileLines.length; i++) {
        const line = fileLines[i];
        if (line.match(/^- /) && line.includes(eventTitle)) {
          targetLineIndex = i;
          console.log('✅ [DELETE_EVENT] Found event by title match at line:', i);
          break;
        }
      }
    }

    // 方法2：如果标题匹配失败，尝试通过事件ID中的时间信息匹配
    if (targetLineIndex === -1) {
      console.log('🔍 [DELETE_EVENT] Trying to match by time from event ID');
      const timeStr = eventId.slice(8, 12); // 提取 HHmm
      const hour = timeStr.slice(0, 2);
      const minute = timeStr.slice(2, 4);
      const timePattern = `${hour}:${minute}`;
      
      console.log('🔍 [DELETE_EVENT] Looking for time pattern:', timePattern);
      
      for (let i = 0; i < fileLines.length; i++) {
        const line = fileLines[i];
        if (line.match(/^- /) && line.includes(timePattern)) {
          targetLineIndex = i;
          console.log('✅ [DELETE_EVENT] Found event by time match at line:', i);
          break;
        }
      }
    }

    // 方法3：如果前两种方法都失败，使用原始的索引方法作为备选
    if (targetLineIndex === -1) {
      console.log('🔍 [DELETE_EVENT] Trying to match by event index as fallback');
      const lineIndex = parseInt(eventId.slice(14));
      let eventCount = 0;

      for (let i = 0; i < fileLines.length; i++) {
        const line = fileLines[i];
        if (line.match(/^- /)) {
          if (eventCount === lineIndex) {
            targetLineIndex = i;
            console.log('✅ [DELETE_EVENT] Found event by index at line:', i);
            break;
          }
          eventCount++;
        }
      }
    }

    if (targetLineIndex === -1) {
      console.error('❌ [DELETE_EVENT] Could not find target event line using any method');
      console.error('❌ [DELETE_EVENT] Event ID:', eventId);
      console.error('❌ [DELETE_EVENT] Event title:', eventTitle);
      throw new Error('Could not find target event line');
    }

    // 找到目标事件行
    const targetLine = fileLines[targetLineIndex];
    console.log('🎯 [DELETE_EVENT] Target line found at index:', targetLineIndex);
    console.log('🎯 [DELETE_EVENT] Target line content:', targetLine);

    // 验证这确实是一个事件行（以 - 开头）
    if (!targetLine.match(/^- /)) {
      console.error('❌ [DELETE_EVENT] Target line is not an event line');
      throw new Error('Target line is not an event line');
    }

    // 找到事件边界
    let startIndex = targetLineIndex;
    let endIndex = targetLineIndex;

    console.log('🔍 [DELETE_EVENT] Finding event boundaries...');

    // 向前查找，找到当前事件的开始位置
    // 当前行就是事件开始行，因为事件以 - 开头
    console.log('📍 [DELETE_EVENT] Event starts at line:', startIndex);

    // 向后查找，找到下一个事件或文件末尾
    let currentIndex = targetLineIndex + 1;
    let foundNextEvent = false;

    while (currentIndex < fileLines.length) {
      const currentLine = fileLines[currentIndex];
      
      // 如果遇到下一个事件行（以 - 开头但不是缩进的）
      if (currentLine.match(/^- /)) {
        console.log('📍 [DELETE_EVENT] Found next event at line:', currentIndex);
        endIndex = currentIndex - 1;
        foundNextEvent = true;
        break;
      }
      
      // 如果遇到标题行（以 # 开头），也停止
      if (currentLine.match(/^#{1,} /)) {
        console.log('📍 [DELETE_EVENT] Found heading at line:', currentIndex);
        endIndex = currentIndex - 1;
        foundNextEvent = true;
        break;
      }
      
      currentIndex++;
    }

    // 如果没有找到下一个事件，删除到文件末尾
    if (!foundNextEvent) {
      endIndex = fileLines.length - 1;
      console.log('📍 [DELETE_EVENT] No next event found, deleting to end of file');
    }

    console.log('📏 [DELETE_EVENT] Event boundaries: start=', startIndex, 'end=', endIndex);
    console.log('📏 [DELETE_EVENT] Lines to delete:', endIndex - startIndex + 1);

    // 显示要删除的内容
    const linesToDelete = fileLines.slice(startIndex, endIndex + 1);
    console.log('🗑️ [DELETE_EVENT] Content to delete:');
    linesToDelete.forEach((line, index) => {
      console.log(`   ${startIndex + index}: ${line}`);
    });

    // 删除指定范围的行
    const newFileLines = [
      ...fileLines.slice(0, startIndex),
      ...fileLines.slice(endIndex + 1)
    ];

    // 重新构建文件内容
    const newFileContent = newFileLines.join('\n');
    
    console.log('💾 [DELETE_EVENT] Writing updated content to file...');
    console.log('📊 [DELETE_EVENT] Original lines:', fileLines.length);
    console.log('📊 [DELETE_EVENT] New lines:', newFileLines.length);
    console.log('📊 [DELETE_EVENT] Deleted lines:', fileLines.length - newFileLines.length);

    // 写入文件
    await vault.modify(file, newFileContent);
    
    console.log('✅ [DELETE_EVENT] Event deleted successfully from file');
    return true;

  }, 'Failed to delete event from daily note');
}
