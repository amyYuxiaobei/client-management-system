package com.xiaobeiy.system;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.rest.core.annotation.HandleAfterCreate;
import org.springframework.data.rest.core.annotation.HandleAfterDelete;
import org.springframework.data.rest.core.annotation.HandleAfterSave;
import org.springframework.data.rest.core.annotation.RepositoryEventHandler;
import org.springframework.hateoas.EntityLinks;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.stereotype.Component;

@Component
@RepositoryEventHandler(Client.class)
public class EventHandler {

	private final SimpMessagingTemplate websocket;

	private final EntityLinks entityLinks;

	@Autowired
	public EventHandler(SimpMessagingTemplate websocket, EntityLinks entityLinks) {
		this.websocket = websocket;
		this.entityLinks = entityLinks;
	}

	@HandleAfterCreate
	public void newClient(Client client) {
		this.websocket.convertAndSend(
				WebSocketConfiguration.MESSAGE_PREFIX + "/newClient", getPath(client));
	}

	@HandleAfterDelete
	public void deleteClient(Client client) {
		this.websocket.convertAndSend(
				WebSocketConfiguration.MESSAGE_PREFIX + "/deleteClient", getPath(client));
	}

	@HandleAfterSave
	public void updateClient(Client client) {
		this.websocket.convertAndSend(
				WebSocketConfiguration.MESSAGE_PREFIX + "/updateClient", getPath(client));
	}

	/**
	 * Take an {@link Client} and get the URI using Spring Data REST's {@link EntityLinks}.
	 *
	 * @param client
	 */
	private String getPath(Client client) {
		return this.entityLinks.linkForSingleResource(client.getClass(),
				client.getId()).toUri().getPath();
	}

}
// end::code[]
