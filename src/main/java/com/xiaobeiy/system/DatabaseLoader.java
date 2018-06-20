package com.xiaobeiy.system;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.AuthorityUtils;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;

@Component
public class DatabaseLoader implements CommandLineRunner {

	private final ClientRepository clients;
	private final ManagerRepository managers;

	@Autowired
	public DatabaseLoader(ClientRepository clientRepository,
						  ManagerRepository managerRepository) {

		this.clients = clientRepository;
		this.managers = managerRepository;
	}

	@Override
	public void run(String... strings) throws Exception {

		Manager greg = this.managers.save(new Manager("greg", "turnquist",
							"ROLE_MANAGER"));
		Manager oliver = this.managers.save(new Manager("oliver", "gierke",
							"ROLE_MANAGER"));
		Manager admin = this.managers.save(new Manager("xiaobei", "lovepiano",
				"ROLE_MANAGER"));

		SecurityContextHolder.getContext().setAuthentication(
			new UsernamePasswordAuthenticationToken("greg", "doesn't matter",
				AuthorityUtils.createAuthorityList("ROLE_MANAGER")));

		this.clients.save(new Client("Frodo", "Baggins", "babaasdasd", "213-124-1231", "ass@gmail.com" , greg));
		this.clients.save(new Client("Bilbo", "Baggins", "babaasdasd", "213-124-1231", "ass@gmail.com", greg));
		this.clients.save(new Client("Gandalf", "the Grey", "babaasdasd", "213-124-1231", "ass@gmail.com", greg));

		SecurityContextHolder.getContext().setAuthentication(
			new UsernamePasswordAuthenticationToken("oliver", "doesn't matter",
				AuthorityUtils.createAuthorityList("ROLE_MANAGER")));

		this.clients.save(new Client("Samwise", "Gamgee", "babaasdasd", "213-124-1231", "ass@gmail.com", oliver));
		this.clients.save(new Client("Merry", "Brandybuck", "babaasdasd", "213-124-1231", "ass@gmail.com", oliver));
		this.clients.save(new Client("Peregrin", "Took", "babaasdasd", "213-124-1231", "ass@gmail.com", oliver));

		SecurityContextHolder.clearContext();
	}
}
// end::code[]