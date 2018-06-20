package com.xiaobeiy.system;

import org.springframework.data.repository.PagingAndSortingRepository;
import org.springframework.data.repository.query.Param;
import org.springframework.security.access.prepost.PreAuthorize;

@PreAuthorize("hasRole('ROLE_MANAGER')")
public interface ClientRepository extends PagingAndSortingRepository<Client, Long> {

	@Override
	@PreAuthorize("#client?.manager == null or #client?.manager?.name == authentication?.name")
	Client save(@Param("client") Client client);

	@Override
	@PreAuthorize("@clientRepository.findOne(#id)?.manager?.name == authentication?.name")
	void delete(@Param("id") Long id);

	@Override
	@PreAuthorize("#client?.manager?.name == authentication?.name")
	void delete(@Param("client") Client client);

}
// end::code[]
