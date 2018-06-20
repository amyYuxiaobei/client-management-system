'use strict';

import Table from '@material-ui/core/Table';
import TableBody from '@material-ui/core/TableBody';
import TableCell from '@material-ui/core/TableCell';
import TableHead from '@material-ui/core/TableHead';
import TableRow from '@material-ui/core/TableRow';
import Paper from '@material-ui/core/Paper';
import { withStyles } from '@material-ui/core/styles';

const React = require('react');
const ReactDOM = require('react-dom')
const when = require('when');
const client = require('./client');

const follow = require('./follow'); // function to hop multiple links by "rel"

const stompClient = require('./websocket-listener');

const root = '/api';

const CustomTableCell = withStyles(theme => ({
  head: {
    backgroundColor: theme.palette.common.black,
    color: theme.palette.common.white,
  },
  body: {
    fontSize: 14,
  },
}))(TableCell);

const styles = theme => ({
  root: {
    width: '100%',
    marginTop: theme.spacing.unit * 3,
    overflowX: 'auto',
  },
  table: {
    minWidth: 700,
  },
  row: {
    '&:nth-of-type(odd)': {
      backgroundColor: theme.palette.background.default,
    },
  },
});

class App extends React.Component {

	constructor(props) {
		super(props);
		this.state = {clients: [], attributes: [], page: 1, pageSize: 2, links: {}
		   , loggedInManager: this.props.loggedInManager};
		this.updatePageSize = this.updatePageSize.bind(this);
		this.onCreate = this.onCreate.bind(this);
		this.onUpdate = this.onUpdate.bind(this);
		this.onDelete = this.onDelete.bind(this);
		this.onNavigate = this.onNavigate.bind(this);
		this.refreshCurrentPage = this.refreshCurrentPage.bind(this);
		this.refreshAndGoToLastPage = this.refreshAndGoToLastPage.bind(this);
	}

	loadFromServer(pageSize) {
		follow(client, root, [
				{rel: 'clients', params: {size: pageSize}}]
		).then(clientCollection => {
			return client({
				method: 'GET',
				path: clientCollection.entity._links.profile.href,
				headers: {'Accept': 'application/schema+json'}
			}).then(schema => {
				// tag::json-schema-filter[]
				/**
				 * Filter unneeded JSON Schema properties, like uri references and
				 * subtypes ($ref).
				 */
				Object.keys(schema.entity.properties).forEach(function (property) {
					if (schema.entity.properties[property].hasOwnProperty('format') &&
						schema.entity.properties[property].format === 'uri') {
						delete schema.entity.properties[property];
					}
					else if (schema.entity.properties[property].hasOwnProperty('$ref')) {
						delete schema.entity.properties[property];
					}
				});

				this.schema = schema.entity;
				this.links = clientCollection.entity._links;
				return clientCollection;
				// end::json-schema-filter[]
			});
		}).then(clientCollection => {
			this.page = clientCollection.entity.page;
			return clientCollection.entity._embedded.clients.map(c =>
					client({
						method: 'GET',
						path: c._links.self.href
					})
			);
		}).then(clientPromises => {
			return when.all(clientPromises);
		}).done(clients => {
			this.setState({
				page: this.page,
				clients: clients,
				attributes: Object.keys(this.schema.properties),
				pageSize: pageSize,
				links: this.links
			});
		});
	}

	// tag::on-create[]
	onCreate(newClient) {
		follow(client, root, ['clients']).done(response => {
			client({
				method: 'POST',
				path: response.entity._links.self.href,
				entity: newClient,
				headers: {'Content-Type': 'application/json'}
			})
		})
	}
	// end::on-create[]

	// tag::on-update[]
	onUpdate(c, updatedClient) {
	    console.log("current client");
	    console.log(c);
	    console.log("update client");
	    console.log(updatedClient);
		if(c.entity.manager.name == this.state.loggedInManager) {
			updatedClient["manager"] = c.entity.manager;
			client({
				method: 'PUT',
				path: c.entity._links.self.href,
				entity: updatedClient,
				headers: {
					'Content-Type': 'application/json',
					'If-Match': c.headers.Etag
				}
			}).done(response => {
				/* Let the websocket handler update the state */
				console.log("goes here")
			}, response => {
			    console.log("HAHAAHAHA")
			    console.log(response);
				if (response.status.code === 403) {
					alert('ACCESS DENIED: You are not authorized to update ' +
						c.entity._links.self.href);
				}
				if (response.status.code === 412) {
					alert('DENIED: Unable to update ' + c.entity._links.self.href +
						'. Your copy is stale.');
				}
			});
		} else {
			alert("You are not authorized to update");
		}
	}
	// end::on-update[]

	// tag::on-delete[]
	onDelete(c) {
		client({method: 'DELETE', path: c.entity._links.self.href}
		).done(response => {/* let the websocket handle updating the UI */},
		response => {
			if (response.status.code === 403) {
				alert('ACCESS DENIED: You are not authorized to delete ' +
					c.entity._links.self.href);
			}
		});
	}
	// end::on-delete[]

	onNavigate(navUri) {
		client({
			method: 'GET',
			path: navUri
		}).then(clientCollection => {
			this.links = clientCollection.entity._links;
			this.page = clientCollection.entity.page;

			return clientCollection.entity._embedded.clients.map(c =>
					client({
						method: 'GET',
						path: c._links.self.href
					})
			);
		}).then(clientPromises => {
			return when.all(clientPromises);
		}).done(clients => {
			this.setState({
				page: this.page,
				clients: clients,
				attributes: Object.keys(this.schema.properties),
				pageSize: this.state.pageSize,
				links: this.links
			});
		});
	}

	updatePageSize(pageSize) {
		if (pageSize !== this.state.pageSize) {
			this.loadFromServer(pageSize);
		}
	}

	// tag::websocket-handlers[]
	refreshAndGoToLastPage(message) {
		follow(client, root, [{
			rel: 'clients',
			params: {size: this.state.pageSize}
		}]).done(response => {
			if (response.entity._links.last !== undefined) {
				this.onNavigate(response.entity._links.last.href);
			} else {
				this.onNavigate(response.entity._links.self.href);
			}
		})
	}

	refreshCurrentPage(message) {
		follow(client, root, [{
			rel: 'clients',
			params: {
				size: this.state.pageSize,
				page: this.state.page.number
			}
		}]).then(clientCollection => {
			this.links = clientCollection.entity._links;
			this.page = clientCollection.entity.page;

			return clientCollection.entity._embedded.clients.map(c => {
				return client({
					method: 'GET',
					path: client._links.self.href
				})
			});
		}).then(clientPromises => {
			return when.all(clientPromises);
		}).then(clients => {
			this.setState({
				page: this.page,
				clients: clients,
				attributes: Object.keys(this.schema.properties),
				pageSize: this.state.pageSize,
				links: this.links
			});
		});
	}
	// end::websocket-handlers[]

	// tag::register-handlers[]
	componentDidMount() {
		this.loadFromServer(this.state.pageSize);
		stompClient.register([
			{route: '/topic/newClient', callback: this.refreshAndGoToLastPage},
			{route: '/topic/updateClient', callback: this.refreshCurrentPage},
			{route: '/topic/deleteClient', callback: this.refreshCurrentPage}
		]);
	}
	// end::register-handlers[]

	render() {
		return (
			<div>
				<CreateDialog attributes={this.state.attributes} onCreate={this.onCreate}/>
				<ClientList page={this.state.page}
							  clients={this.state.clients}
							  links={this.state.links}
							  pageSize={this.state.pageSize}
							  attributes={this.state.attributes}
							  onNavigate={this.onNavigate}
							  onUpdate={this.onUpdate}
							  onDelete={this.onDelete}
							  updatePageSize={this.updatePageSize}
							  loggedInManager={this.state.loggedInManager}/>
			</div>
		)
	}
}

class CreateDialog extends React.Component {

	constructor(props) {
		super(props);
		this.handleSubmit = this.handleSubmit.bind(this);
	}

	handleSubmit(e) {
		e.preventDefault();
		var newClient = {};
		this.props.attributes.forEach(attribute => {
			newClient[attribute] = ReactDOM.findDOMNode(this.refs[attribute]).value.trim();
		});
		this.props.onCreate(newClient);
		this.props.attributes.forEach(attribute => {
			ReactDOM.findDOMNode(this.refs[attribute]).value = ''; // clear out the dialog's inputs
		});
		window.location = "#";
	}

	render() {
		var inputs = this.props.attributes.map(attribute =>
				<p key={attribute}>
					<input type="text" placeholder={attribute} ref={attribute} className="field" />
				</p>
		);
		return (
			<div className="padding-top-large">
				<a href="#createClient">Create</a>

				<div id="createClient" className="modalDialog">
					<div>
						<a href="#" title="Close" className="close">X</a>

						<h2>Create new client</h2>

						<form>
							{inputs}
							<button onClick={this.handleSubmit}>Create</button>
						</form>
					</div>
				</div>
			</div>
		)
	}
}

class UpdateDialog extends React.Component {

	constructor(props) {
		super(props);
		this.handleSubmit = this.handleSubmit.bind(this);
	}

	handleSubmit(e) {
		e.preventDefault();
		var updatedClient = {};
		this.props.attributes.forEach(attribute => {
			updatedClient[attribute] = ReactDOM.findDOMNode(this.refs[attribute]).value.trim();
		});
		this.props.onUpdate(this.props.client, updatedClient);
		window.location = "#";
	}

	render() {
		var inputs = this.props.attributes.map(attribute =>
				<p key={this.props.client.entity[attribute]}>
					<input type="text" placeholder={attribute}
						   defaultValue={this.props.client.entity[attribute]}
						   ref={attribute} className="field" />
				</p>
		);

		var dialogId = "updateClient-" + this.props.client.entity._links.self.href;

		var isManagerCorrect = this.props.client.entity.manager.name == this.props.loggedInManager;

		if (isManagerCorrect == false) {
			return (
					<div>
						<a>Not Your Client</a>
					</div>
				)
		} else {
			return (
				<div>
					<a href={"#" + dialogId}>Update</a>

					<div id={dialogId} className="modalDialog">
						<div>
							<a href="#" title="Close" className="close">X</a>

							<h2>Update an client</h2>

							<form>
								{inputs}
								<button onClick={this.handleSubmit}>Update</button>
							</form>
						</div>
					</div>
				</div>
			)
		}
	}

}

class ClientList extends React.Component {

	constructor(props) {
		super(props);
		this.handleNavFirst = this.handleNavFirst.bind(this);
		this.handleNavPrev = this.handleNavPrev.bind(this);
		this.handleNavNext = this.handleNavNext.bind(this);
		this.handleNavLast = this.handleNavLast.bind(this);
		this.handleInput = this.handleInput.bind(this);
	}

	handleInput(e) {
		e.preventDefault();
		var pageSize = ReactDOM.findDOMNode(this.refs.pageSize).value;
		if (/^[0-9]+$/.test(pageSize)) {
			this.props.updatePageSize(pageSize);
		} else {
			ReactDOM.findDOMNode(this.refs.pageSize).value = pageSize.substring(0, pageSize.length - 1);
		}
	}

	handleNavFirst(e) {
		e.preventDefault();
		this.props.onNavigate(this.props.links.first.href);
	}

	handleNavPrev(e) {
		e.preventDefault();
		this.props.onNavigate(this.props.links.prev.href);
	}

	handleNavNext(e) {
		e.preventDefault();
		this.props.onNavigate(this.props.links.next.href);
	}

	handleNavLast(e) {
		e.preventDefault();
		this.props.onNavigate(this.props.links.last.href);
	}

	render() {
		var pageInfo = this.props.page.hasOwnProperty("number") ?
			<h3 className="text-align-middle">Clients - Page {this.props.page.number + 1} of {this.props.page.totalPages}</h3> : null;

		var clients = this.props.clients.map(client =>
			<Client key={client.entity._links.self.href}
					  client={client}
					  attributes={this.props.attributes}
					  onUpdate={this.props.onUpdate}
					  onDelete={this.props.onDelete}
					  loggedInManager={this.props.loggedInManager}/>
		);

		var navLinks = [];
		if ("first" in this.props.links) {
			navLinks.push(<button key="first" onClick={this.handleNavFirst}>&lt;&lt;</button>);
		}
		if ("prev" in this.props.links) {
			navLinks.push(<button key="prev" onClick={this.handleNavPrev}>&lt;</button>);
		}
		if ("next" in this.props.links) {
			navLinks.push(<button key="next" onClick={this.handleNavNext}>&gt;</button>);
		}
		if ("last" in this.props.links) {
			navLinks.push(<button key="last" onClick={this.handleNavLast}>&gt;&gt;</button>);
		}

		return (
			<div>
				{pageInfo}
				<input ref="pageSize" defaultValue={this.props.pageSize} onInput={this.handleInput}/>
				<br></br>
				<Table>
					<TableHead>
						<TableRow>
							<CustomTableCell>First Name</CustomTableCell>
							<CustomTableCell>Last Name</CustomTableCell>
							<CustomTableCell>Address</CustomTableCell>
							<CustomTableCell>Email</CustomTableCell>
							<CustomTableCell>PhoneNumber</CustomTableCell>
							<CustomTableCell>Manager</CustomTableCell>
							<CustomTableCell></CustomTableCell>
                            <CustomTableCell></CustomTableCell>
						</TableRow>
					</TableHead>
					<TableBody>
						{clients}
					</TableBody>
				</Table>
				<div className="navigation">
					{navLinks}
				</div>
			</div>
		)
	}
}

// tag::client[]
class Client extends React.Component {

	constructor(props) {
		super(props);
		this.handleDelete = this.handleDelete.bind(this);
	}

	handleDelete() {
		this.props.onDelete(this.props.client);
	}

	render() {
	    console.log(this.props.attributes);
		return (
			<TableRow>
				<CustomTableCell>{this.props.client.entity.firstName}</CustomTableCell>
				<CustomTableCell>{this.props.client.entity.lastName}</CustomTableCell>
				<CustomTableCell>{this.props.client.entity.address}</CustomTableCell>
				<CustomTableCell>{this.props.client.entity.email}</CustomTableCell>
				<CustomTableCell>{this.props.client.entity.phoneNumber}</CustomTableCell>
				<CustomTableCell>{this.props.client.entity.manager.name}</CustomTableCell>
				<CustomTableCell>
					<UpdateDialog client={this.props.client}
								  attributes={this.props.attributes}
								  onUpdate={this.props.onUpdate}
								  loggedInManager={this.props.loggedInManager}/>
				</CustomTableCell>
				<CustomTableCell>
					<button onClick={this.handleDelete}>Delete</button>
				</CustomTableCell>
			</TableRow>
		)
	}
}
// end::client[]

ReactDOM.render(
	<App loggedInManager={document.getElementById('managername').innerHTML } />,
	document.getElementById('react')
)

