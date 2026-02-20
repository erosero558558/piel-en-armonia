<?php
declare(strict_types=1);

require_once __DIR__ . '/Event.php';

/**
 * Simple Synchronous Event Dispatcher.
 */
class EventDispatcher
{
    /**
     * @var array<string, callable[]>
     */
    private array $listeners = [];

    /**
     * Adds a listener for a specific event.
     *
     * @param string $eventName The full class name of the event.
     * @param callable $listener The listener callback.
     */
    public function addListener(string $eventName, callable $listener): void
    {
        if (!isset($this->listeners[$eventName])) {
            $this->listeners[$eventName] = [];
        }
        $this->listeners[$eventName][] = $listener;
    }

    /**
     * Dispatches an event to all registered listeners.
     *
     * @param Event $event The event object to dispatch.
     * @return Event The passed event object (potentially modified by listeners).
     */
    public function dispatch(Event $event): Event
    {
        $eventName = get_class($event);
        if (!isset($this->listeners[$eventName])) {
            return $event;
        }

        foreach ($this->listeners[$eventName] as $listener) {
            if ($event->isPropagationStopped()) {
                break;
            }
            call_user_func($listener, $event);
        }

        return $event;
    }

    /**
     * Gets the listeners for a specific event.
     *
     * @param string $eventName
     * @return array
     */
    public function getListeners(string $eventName): array
    {
        return $this->listeners[$eventName] ?? [];
    }
}
