import React from 'react';
import {moment, Menu} from 'obsidian';
import {getMarkBasedOnEvent} from '@/obComponents/parser';
import {eventService} from '@/services';
import useFileStore from '@/stores/fileStore';
import EventEditModal from './EventEditModal';
import {Event} from 'react-big-calendar';
import {t} from '@/translations/helper';

// Define props interface that matches react-big-calendar's expectations
interface EventProps<TEvent = Event> {
  event: TEvent & Model.Event; // Combine the Event type from react-big-calendar with our Model.Event
  title: string; // Changed from ReactNode to string to match react-big-calendar's expectations
  // Additional props that react-big-calendar might pass but we don't use
  localizer: any; // Changed from optional to required
  slotStart: Date; // Changed from optional to required
  slotEnd: Date; // Changed from optional to required
  continuesPrior: boolean;
  continuesAfter: boolean;
}

// Define a type extension for additional properties that might be present but not in the Model.Event interface
interface ExtendedEvent extends Model.Event {
  showTime?: boolean;
}

/**
 * Custom Event Component for Calendar
 *
 * Renders events with their type markers based on the EventType property
 * If EventType is not Default, it will show the corresponding marker
 */
const EventComponent: React.FC<EventProps<Event>> = ({
  event,
  title,
  continuesPrior,
  continuesAfter,
  localizer,
  slotStart,
  slotEnd,
}) => {
  // Get app instance from fileStore
  const app = useFileStore((state) => state.app);

  // Cast event to ExtendedEvent to handle additional properties
  const extendedEvent = event as ExtendedEvent;

  // Check if event has a non-default type
  const isDefaultType = !event.eventType || event.eventType === 'default';

  // Map of event types to their marker emojis
  const mark = getMarkBasedOnEvent(event.eventType);

  // Handle checkbox click to toggle event status
  const handleCheckboxClick = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent event selection when clicking checkbox
    
    try {
      // Determine the new event type based on current state
      let newEventType: string;
      
      if (event.eventType === 'TASK-TODO') {
        // If currently TODO, mark as DONE
        newEventType = 'TASK-DONE';
      } else if (event.eventType === 'TASK-DONE') {
        // If currently DONE, mark as TODO
        newEventType = 'TASK-TODO';
      } else {
        // For other types, default to TODO
        newEventType = 'TASK-TODO';
      }

      // Update the event with the new type
      const updatedEvent = await eventService.updateEvent(
        event.id,
        event.title,
        newEventType,
        event.start,
        event.end,
        event.notes
      );

      if (updatedEvent) {
        console.log(`Event status changed to ${newEventType}`);
        // Force refresh the events list
        if (app) {
          await eventService.fetchAllEvents(app);
        }
      }
    } catch (error) {
      console.error('Error toggling event status:', error);
    }
  };

  // Handle right-click to open context menu
  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();

    // Create a menu
    const menu = new Menu();

    // Add Edit option
    menu.addItem((item) => {
      item
        .setTitle(t('Edit event'))
        .setIcon('pencil')
        .onClick(() => {
          // Make sure app is available
          if (!app) {
            console.error('App instance not available');
            return;
          }

          // Open the event edit modal
          const modal = new EventEditModal(app, event, (result) => {
            // Handle the result when save is clicked
            eventService
              .editEvent(
                {
                  ...event,
                  eventType: result.eventType,
                  allDay: result.allDay,
                  notes: result.notes,
                },
                result.startDate,
                result.endDate,
                result.title,
              )
              .then((updatedEvent) => {
                if (updatedEvent) {
                  console.log('Event updated successfully:', updatedEvent);
                } else {
                  console.error('Failed to update event');
                }
              })
              .catch((error) => {
                console.error('Error updating event:', error);
              });
          });

          // Open the modal
          modal.open();
        });
    });

    // Add Duplicate option
    menu.addItem((item) => {
      item
        .setTitle(t('Duplicate event'))
        .setIcon('copy')
        .onClick(async () => {
          try {
            // Create a new event with the same details
            const newEvent = await eventService.createEvent(event.title, event.start, event.end);
            console.log('Event duplicated successfully:', newEvent);
          } catch (error) {
            console.error('Error duplicating event:', error);
          }
        });
    });

    // Add separator before event type options
    menu.addSeparator();

    // Add Event Type submenu
    const eventTypes = [
      {type: 'default', name: t('Set type: Default')},
      {type: 'TASK-TODO', name: t('Set type: To-Do')},
      {type: 'TASK-DONE', name: t('Set type: Done')},
      {type: 'TASK-IN_PROGRESS', name: t('Set type: In Progress')},
      {type: 'TASK-IMPORTANT', name: t('Set type: Important')},
    ];

    // Add Type submenu
    eventTypes.forEach((typeOption) => {
      menu.addItem((item) => {
        const isCurrentType = event.eventType === typeOption.type;
        item
          .setTitle(typeOption.name)
          .setChecked(isCurrentType)
          .setIcon(typeOption.type === 'default' ? 'pencil' : 'check')
          .onClick(async () => {
            if (isCurrentType) return; // No need to update if it's already the current type

            try {
              // Update the event with the new type
              const updatedEvent = await eventService.updateEvent(
                event.id,
                event.title,
                typeOption.type,
                event.start,
                event.end,
                event.notes
              );

              if (updatedEvent) {
                console.log(`Event type changed to ${typeOption.name}`);
                // Force refresh the events list
                if (app) {
                  await eventService.fetchAllEvents(app);
                }
              }
            } catch (error) {
              console.error('Error changing event type:', error);
            }
          });
      });
    });

    menu.addSeparator();

    // Add Delete option
    menu.addItem((item) => {
      item
        // @ts-expect-error internal method
        .setWarning(true)
        .setTitle(t('Delete event'))
        .setIcon('trash')
        .onClick(async () => {
          try {
            const success = await eventService.deleteEventById(event.id);
            if (success) {
              console.log('Event deleted successfully');
              // Force refresh the events list
              if (app) {
                await eventService.fetchAllEvents(app);
              }
            } else {
              console.error('Failed to delete event');
            }
          } catch (error) {
            console.error('Error deleting event:', error);
          }
        });
    });

    // Show the menu at the mouse position
    menu.showAtMouseEvent(e.nativeEvent);
  };

  // Format dates for display similar to the Obsidian task format
  const formatDateInfo = () => {
    let dateInfo = '';

    // Add start date if available
    if (event.start) {
      const startDate = new Date(event.start);
      dateInfo += ` 🛫 ${moment(startDate).format('YYYY-MM-DD')}`;
    }

    // Add end date if available and different from start date
    if (event.end) {
      const endDate = new Date(event.end);
      const startDate = new Date(event.start);

      // Only add end date if it's different from start date
      // Or if it's an all-day event that spans multiple days
      if (
        startDate.toDateString() !== endDate.toDateString() ||
        (event.allDay && endDate.getTime() - startDate.getTime() > 86400000) // More than one day
      ) {
        dateInfo += ` 📅 ${moment(endDate).format('YYYY-MM-DD')}`;
      }
    }

    return dateInfo;
  };

  // Combine event title with date info and notes for tooltip
  const getTooltipContent = () => {
    const originalTitle = typeof title === 'string' ? title : 'Event';
    const dateInfo = formatDateInfo();
    const notesInfo = event.notes ? `\n备注: ${event.notes}` : '';
    return `${originalTitle}${dateInfo}${notesInfo}`;
  };

  // Style object for the event, can be customized based on event type
  const getEventStyle = () => {
    const baseStyle: React.CSSProperties = {
      display: 'flex',
      flexDirection: 'row',
      alignItems: 'center',
      padding: 'var(--size-2-1) var(--size-2-2)',
      height: '100%',
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    };

    return baseStyle;
  };

  return (
    <div
      style={getEventStyle()}
      className={`rbc-event-content ${event.eventType || 'Default'}`}
      aria-label={getTooltipContent()}
      onContextMenu={handleContextMenu}
    >
      {/* Type marker */}
      {!isDefaultType && (
        <span className="event-type-marker">
          <input
            data-task={mark}
            checked={event.eventType !== 'TASK-TODO'}
            type="checkbox"
            className="task-list-item-checkbox"
            onClick={handleCheckboxClick}
            style={{ cursor: 'pointer' }}
          ></input>
        </span>
      )}

      {/* Event title */}
      <span className="event-title">{title}</span>

      {/* Time display for non-all-day events */}
      {event.allDay === false && extendedEvent.showTime !== false && (
        <span className="event-time">{moment(event.start).format('HH:mm')}</span>
      )}
    </div>
  );
};

export default EventComponent;
