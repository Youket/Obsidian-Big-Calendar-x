import {App, Modal, Setting, moment} from 'obsidian';
import {eventService} from '@/services';
import {t} from '@/translations/helper';

interface EventEditResult {
  title: string;
  eventType: string;
  startDate: Date;
  endDate: Date;
  allDay: boolean;
  notes?: string;
}

/**
 * Modal for editing calendar events
 */
export default class EventEditModal extends Modal {
  private event: Model.Event;
  private result: EventEditResult;
  private onSave: (result: EventEditResult) => void;

  constructor(app: App, event: Model.Event, onSave: (result: EventEditResult) => void) {
    super(app);

    this.event = event;
    this.onSave = onSave;

    // Initialize with current event values
    this.result = {
      title: event.title,
      eventType: event.eventType || 'default',
      startDate: new Date(event.start),
      endDate: new Date(event.end),
      allDay: event.allDay,
      notes: event.notes || '',
    };
  }

  onOpen() {
    const {contentEl, titleEl} = this;

    // Set the modal title
    titleEl.setText(t('Edit Event'));

    // Create form container
    const formContainer = contentEl.createDiv({cls: 'event-edit-form'});

    // Event title
    new Setting(formContainer)
      .setName(t('Title'))
      .setDesc(t('Event title'))
      .addText((text) => {
        text.setValue(this.result.title).onChange((value) => {
          this.result.title = value;
        });
      });

    // Event type selector
    new Setting(formContainer)
      .setName(t('Event Type'))
      .setDesc(t('Type of event'))
      .addDropdown((dropdown) => {
        // Add event type options
        const eventTypes = [
          {value: 'default', name: 'Default'},
          {value: 'TASK-TODO', name: 'To-Do'},
          {value: 'TASK-DONE', name: 'Done'},
          {value: 'TASK-IN_PROGRESS', name: 'In Progress'},
          {value: 'TASK-IMPORTANT', name: 'Important'},
        ];

        // Add options to dropdown
        eventTypes.forEach((type) => {
          dropdown.addOption(type.value, type.name);
        });

        // Set current value and handle changes
        dropdown.setValue(this.result.eventType).onChange((value) => {
          this.result.eventType = value;
        });
      });

    // Event notes
    new Setting(formContainer)
      .setName(t('Notes'))
      .setDesc(t('Additional notes for the event (optional)'))
      .addTextArea((text) => {
        text.setValue(this.result.notes || '').onChange((value) => {
          this.result.notes = value;
        });
        
        // 设置输入框样式
        text.inputEl.style.minHeight = '80px';
        text.inputEl.style.maxHeight = '300px';
        text.inputEl.style.resize = 'vertical';
        text.inputEl.style.overflow = 'auto';
        text.inputEl.style.fontFamily = 'var(--font-monospace)';
        text.inputEl.style.lineHeight = '1.4';
        text.inputEl.style.padding = '8px 12px';
        text.inputEl.style.borderRadius = '4px';
        text.inputEl.style.border = '1px solid var(--background-modifier-border)';
        text.inputEl.style.backgroundColor = 'var(--background-primary)';
        text.inputEl.style.color = 'var(--text-normal)';
        text.inputEl.style.width = '100%';
        text.inputEl.style.boxSizing = 'border-box';
        
        // 确保 textarea 可以正确换行
        text.inputEl.addEventListener('keydown', (e) => {
          // 允许 Enter 键换行
          if (e.key === 'Enter') {
            // 不阻止默认行为，允许换行
            return;
          }
          
          // 处理 Tab 键
          if (e.key === 'Tab') {
            e.preventDefault();
            // 插入制表符
            const start = text.inputEl.selectionStart;
            const end = text.inputEl.selectionEnd;
            const textValue = text.inputEl.value;
            text.inputEl.value = textValue.substring(0, start) + '\t' + textValue.substring(end);
            text.inputEl.selectionStart = text.inputEl.selectionEnd = start + 1;
            this.result.notes = text.inputEl.value;
          }
        });
      });

    // All day toggle
    new Setting(formContainer)
      .setName('All Day')
      .setDesc('Is this an all-day event?')
      .addToggle((toggle) => {
        toggle.setValue(this.result.allDay).onChange((value) => {
          this.result.allDay = value;
        });
      });

    // Start date and time
    new Setting(formContainer)
      .setName(t('Start Date'))
      .setDesc(t('When the event starts'))
      .addText((text) => {
        const dateString = moment(this.result.startDate).format('YYYY-MM-DD HH:mm');
        text.setValue(dateString).onChange((value) => {
          const date = moment(value, 'YYYY-MM-DD HH:mm').toDate();
          if (!isNaN(date.getTime())) {
            this.result.startDate = date;
          }
        });
      });

    // End date and time
    new Setting(formContainer)
      .setName(t('End Date'))
      .setDesc(t('When the event ends'))
      .addText((text) => {
        const dateString = moment(this.result.endDate).format('YYYY-MM-DD HH:mm');
        text.setValue(dateString).onChange((value) => {
          const date = moment(value, 'YYYY-MM-DD HH:mm').toDate();
          if (!isNaN(date.getTime())) {
            this.result.endDate = date;
          }
        });
      });

    // Buttons container
    const buttonsContainer = contentEl.createDiv({cls: 'event-edit-buttons'});

    // Save button
    const saveButton = buttonsContainer.createEl('button', {
      text: t('Save'),
      cls: 'mod-cta',
    });

    saveButton.addEventListener('click', () => {
      this.onSave(this.result);
      this.close();
    });

    // Cancel button
    const cancelButton = buttonsContainer.createEl('button', {
      text: t('Cancel'),
    });

    cancelButton.addEventListener('click', () => {
      this.close();
    });
  }

  onClose() {
    const {contentEl} = this;
    contentEl.empty();
  }
}
